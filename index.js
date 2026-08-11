const express = require('express');
const pool = require('./database');
const session = require('express-session');
const path = require('path');
const cookieParser = require('cookie-parser');
const ejsMate = require('ejs-mate');
const [sales, productUsage, daily, restockReport] = require("./report");
const authentication = require('./authentication');
const { foodIDEndpoint } = require('./food');
const { translateText } = require('./translate'); // Import the translate function

const app = express();
const port = 3000;

app.use(session({
    secret: 'your-secret-key', // Change this to a random string
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // In production, set 'secure: true' with HTTPS
}));


app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cookieParser());

app.get('/', async (req, res) => {
    try {
        console.log("Connecting to the database...");
        console.log("Executing query: SELECT * FROM containerimage;");

        const result = await pool.query('SELECT * FROM containerimage');
        res.render('template', { food: result.rows });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});

app.post('/createsession', authentication.createSession);

app.get('/logout', authentication.doLogOut);

app.post('/get-google-id', authentication.getGoogleID);

//app.post('/foodids', foodIDEndpoint);


/* uncomment auth stuff */
app.get('/cashier', authentication.verifySession, async (req, res) => {
    try {
        let currentOrder = [];
        console.log("Connecting to the database...");

        // Fetch food items
        console.log("Executing query: SELECT * FROM food;");
        const foodResult = await pool.query("SELECT food_name, food_id, itemtype FROM food WHERE itemtype IN ('side', 'entree', 'drink', 'appetizer', 'both') ORDER BY food_id ASC");
        // Fetch containers
        console.log("Executing query: SELECT container_name, price FROM containerimage ORDER BY price ASC;");
        const containerResult = await pool.query("SELECT container_name, price FROM containerimage ORDER BY price ASC");

        // Fetch last container_id
        console.log("Executing query: SELECT MAX(container_id) FROM container;");
        const containerIDresult = await pool.query('SELECT MAX(container_id) FROM container')
        const maxContainerId = containerIDresult.rows[0].max;
        // Fetch last order_id
        const result = await pool.query('SELECT MAX(order_id) FROM customerorder');
        const maxOrderId = result.rows[0].max;
        //console.log(maxOrderId.rows);

        res.render('cashier', { food: foodResult.rows, container: containerResult.rows, maxContainerId, maxOrderId, currentOrder });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});


function initCart(req) {
    if (!req.session.cart) {
        req.session.cart = [];
    }
}
app.post('/add-to-cart', (req, res) => {
    initCart(req);

    const { order } = req.body;
    if (order) {
        req.session.cart.push(order);
        res.json({ message: 'Order added to cart', cart: req.session.cart });
    } else {
        res.status(400).json({ error: 'No order data received' });
    }
});
app.get('/cart', async (req, res) => {
    initCart(req);

    try {
        console.log("Connecting to the database...");
        console.log("Performing query: SELECT MAX(order_id) FROM customerorder;");
        const result = await pool.query('SELECT MAX(order_id) FROM customerorder');
        const maxOrderId = result.rows[0].max;

        res.render('cart', { cart: req.session.cart, maxOrderId });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});

app.get('/complaintForm', async (req, res) => {
    try {
        res.render('complaintForm'); // Load the complaint form
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Unable to load the complaint form.' }); // Use a custom error page
    }
});

app.post('/submitComplaint', async (req, res) => {
    const { name, complaint, email } = req.body;

    try {
        const countQuery = await pool.query('SELECT COUNT(*) FROM complaints');
        const count = parseInt(countQuery.rows[0].count);

        const nextComplaintId = count + 1;

        const result = await pool.query(
            `INSERT INTO complaints (complaint_id, name, email, complaint_text, date) 
             VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
            [nextComplaintId, name, email, complaint]
        );

        res.redirect(`/`);
    } catch (err) {
        console.error('Error saving menu item:', err);
        res.status(500).send('Error saving menu item');
    }
});

app.get('/menuEdit', authentication.verifySession, authentication.managerPermissions, async (req, res) => {

    try {
        console.log("Connecting to the database...");
        console.log("Performing query: SELECT * FROM food;");
        const result = await pool.query('SELECT * FROM food');

        res.render('menuEdit', { food: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});

app.get('/orders', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const { order_date } = req.query; // Get the selected date from the query params

    let query;
    let params;

    if (order_date) {
        query = `
        SELECT 
        o.order_id AS order_id,
        o.order_date,
        o.status,
        o.order_time,
        o.price,
        -- Subquery to get container names for this order
        (SELECT string_agg(c.container_name, ', ')
        FROM container c
        JOIN orderxcontainer oxc ON c.container_id = oxc.container_id
        WHERE oxc.order_id = o.order_id) AS container_names,
        -- Subquery to get food names for this order
        (SELECT string_agg(f.food_name, ', ')
        FROM food f
        JOIN containerxfood cxf ON f.food_id = cxf.food_id
        JOIN container c ON c.container_id = cxf.container_id
        JOIN orderxcontainer oxc ON c.container_id = oxc.container_id
        WHERE oxc.order_id = o.order_id) AS food_names
        FROM customerorder o
        WHERE o.order_date = $1
        ORDER BY o.order_date DESC, o.order_id;

      `;
        params = [order_date];
    } else {
        query = `
        SELECT 
        o.order_id AS order_id,
        o.order_date,
         o.status,
        o.order_time,
        o.price,
        -- Subquery to get container names for this order
        (SELECT string_agg(c.container_name, ', ')
        FROM container c
        JOIN orderxcontainer oxc ON c.container_id = oxc.container_id
        WHERE oxc.order_id = o.order_id) AS container_names,
        -- Subquery to get food names for this order
        (SELECT string_agg(f.food_name, ', ')
        FROM food f
        JOIN containerxfood cxf ON f.food_id = cxf.food_id
        JOIN container c ON c.container_id = cxf.container_id
        JOIN orderxcontainer oxc ON c.container_id = oxc.container_id
        WHERE oxc.order_id = o.order_id) AS food_names
        FROM customerorder o
        ORDER BY o.order_date DESC, o.order_id;
      `;
        params = [];
    }

    try {
        // Query the database
        const result = await pool.query(query, params);

        // Render the orders page with the data
        res.render('orders', {
            orders: result.rows,
            selectedDate: order_date || null // Pass selectedDate to the EJS template
        });
    } catch (err) {
        console.error('Error executing query', err.stack);
        res.status(500).send('Error fetching orders');
    }
});

app.get('/orders/:id', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const id = req.params.id; // Get the order ID from the URL parameter

    try {
        const query = `
        SELECT 
            o.order_id AS order_id,
            o.order_date,
            o.order_time,
             o.status,
            o.price,
            c.container_id,
            c.container_name,
            f.food_id,
            f.food_name
        FROM customerorder o
        -- Join to get containers related to the order
        LEFT JOIN orderxcontainer oxc ON oxc.order_id = o.order_id
        LEFT JOIN container c ON c.container_id = oxc.container_id
        -- Join to get food items related to the containers
        LEFT JOIN containerxfood cxf ON c.container_id = cxf.container_id
        LEFT JOIN food f ON f.food_id = cxf.food_id
        WHERE o.order_id = $1
        ORDER BY c.container_name, f.food_name;
        `;

        // Execute the query with the order ID
        const result = await pool.query(query, [id]);

        // If no order is found, return a 404 response
        if (result.rows.length === 0) {
            return res.status(404).send('Order not found');
        }

        // Organize the data by container and their foods
        const orderDetails = result.rows.reduce((order, row) => {
            const containerName = row.container_name;
            const foodName = row.food_name;

            // Add container if it doesn't exist
            if (!order[containerName]) {
                order[containerName] = [];
            }

            // Add food item to the corresponding container
            if (foodName) {
                order[containerName].push(foodName);
            }

            return order;
        }, {});

        // Render the 'orderDisplay' template with the order details
        res.render('orderDisplay', {
            order: result.rows[0],
            containers: orderDetails
        });
    } catch (err) {
        console.error('Error fetching order details:', err);
        res.status(500).send('Error fetching order details');
    }
});

app.post('/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await pool.query(
            "UPDATE customerorder SET status = $1 WHERE order_id = $2",
            [status, id]
        );
        res.redirect(`/orders/${id}`);
    } catch (err) {
        console.error('Error saving order:', err);
        res.status(500).send('Error saving order:');
    }
});

app.post('/orders/:id/delete', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query('DELETE FROM containerxfood WHERE container_id IN (SELECT container_id FROM orderxcontainer WHERE order_id = $1)', [id]);
        await pool.query('DELETE FROM orderxcontainer WHERE order_id = $1', [id]);

        await pool.query('DELETE FROM customerorder WHERE order_id = $1', [id]);

        res.redirect(`/orders`);
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});



app.get('/kitchen-view', authentication.verifySession, async (req, res) => {
    try {
        // SQL Query to get all the relevant data
        const result = await pool.query(`
            SELECT
                co.order_id,
                co.bump_value,     
                co.order_date,
                co.order_time,
                co.is_in_process,
                c.container_id,
                c.container_name,
                f.food_id,
                f.food_name
            FROM
                customerorder co
            JOIN
                orderxcontainer ox ON co.order_id = ox.order_id
            JOIN
                container c ON ox.container_id = c.container_id
            JOIN
                containerxfood cx ON c.container_id = cx.container_id
            JOIN
                food f ON cx.food_id = f.food_id
            WHERE
                co.status = 'processing'
            ORDER BY
                co.order_time ASC
        `);

        // Group the food items by container and order
        const orders = [];
        result.rows.forEach(row => {
            // Find the order or create it
            let order = orders.find(order => order.order_id === row.order_id);
            if (!order) {
                order = {
                    order_id: row.order_id,
                    order_date: row.order_date,
                    bump_value: row.bump_value,   // Use bump_value
                    order_time: row.order_time,
                    is_in_process: row.is_in_process,
                    containers: []
                };
                orders.push(order);
            }

            // Find or create the container
            let container = order.containers.find(container => container.container_id === row.container_id);
            if (!container) {
                container = {
                    container_id: row.container_id,
                    container_name: row.container_name,
                    food_items: []
                };
                order.containers.push(container);
            }

            // Add the food item to the container
            container.food_items.push({
                food_id: row.food_id,
                food_name: row.food_name
            });
        });

        // Separate orders into two arrays
        const ordersWithBumpValueGreaterThanZero = orders.filter(order => order.bump_value > 0);
        const ordersWithBumpValueZero = orders.filter(order => order.bump_value == 0);

        // Sort orders with bump_value > 1 in descending order
        ordersWithBumpValueGreaterThanZero.sort((a, b) => b.bump_value - a.bump_value);

        // Sort orders with bump_value <= 1 in ascending order
        ordersWithBumpValueZero.sort((a, b) => a.bump_value - b.bump_value);

        // Concatenate both sorted arrays: orders with bump_value > 1 come first
        const sortedOrders = [...ordersWithBumpValueGreaterThanZero, ...ordersWithBumpValueZero];

        // Pass the orders data to the template
        res.render('kitchen-view', { orders: sortedOrders });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send("Error fetching data");
    }
});



app.post('/bumpOrder/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    // Ensure orderId is a valid number
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }

    // Step 1: Retrieve the highest bump_value in the "processing" orders
    const query = `
        SELECT MAX(bump_value) AS highest_bump_value
        FROM customerorder
        WHERE status = 'processing'
    `;

    pool.query(query, (err, result) => {
        if (err) {
            console.error('Error retrieving the highest bump value:', err);
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        }

        // Step 2: If no "processing" orders are found, default the bump_value to 1
        const highestBumpValue = result.rows[0].highest_bump_value || 0;  // If no max found, start from 0

        // Step 3: Increment the bump value by 1
        const newBumpValue = highestBumpValue + 1;

        // Step 4: Update the specific order with the new bump_value and bumped status
        const updateQuery = `
            UPDATE customerorder
            SET bump_value = $1
            WHERE order_id = $2
            RETURNING *;
        `;

        pool.query(updateQuery, [newBumpValue, orderId], (err, result) => {
            if (err) {
                console.error('Error updating the order:', err);
                return res.status(500).json({ success: false, message: 'Internal Server Error' });
            }

            // If the order was not found (no rows were updated)
            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // If the order was bumped successfully
            res.status(200).json({ success: true, message: 'Order has been bumped' });
        });
    });
});


app.post('/recallOrder/:orderId', (req, res) => {
    const orderId = req.params.orderId;
    // Ensure orderId is a valid number
    if (isNaN(orderId)) {
        return res.status(400).json({ success: false, message: 'Invalid order ID' });
    }
        const updateQuery = `
            UPDATE customerorder
            SET status = 'cancelled'
            WHERE order_id = $1
            RETURNING *;
        `;

        pool.query(updateQuery, [orderId], (err, result) => {
            if (err) {
                console.error('Error updating the order:', err);
                return res.status(500).json({ success: false, message: 'Internal Server Error' });
            }

            // If the order was not found (no rows were updated)
            if (result.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // If the order was bumped successfully
            res.status(200).json({ success: true, message: 'Order has been bumped' });
        });
    });

    app.post('/finishOrder/:orderId', async (req, res) => {
        const orderId = req.params.orderId;

        if (isNaN(orderId)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }
    
        const client = await pool.connect(); // Using the pool to get a client for the transaction
    
        try {
            // Start a transaction
            await client.query('BEGIN');
    
            // 1. Query to get the containers related to this order
            console.log(`
                SELECT container_id
                FROM orderxcontainer
                WHERE order_id = $1;
            `);
            const containersQuery = `
                SELECT container_id
                FROM orderxcontainer
                WHERE order_id = $1;
            `;
            const containersResult = await client.query(containersQuery, [orderId]);
    
            if (containersResult.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
    
            const containerIds = containersResult.rows.map(row => row.container_id);

            const foodsQuery = `
                SELECT cf.food_id, fs.stock_id
                FROM containerxfood cf
                JOIN foodxstock fs ON cf.food_id = fs.food_id
                WHERE cf.container_id = ANY($1::int[]);
            `;
            const foodsResult = await client.query(foodsQuery, [containerIds]);
    
            if (foodsResult.rowCount === 0) {
                return res.status(404).json({ success: false, message: 'No food items found for this order' });
            }
    
            for (const food of foodsResult.rows) {
                const foodId = food.food_id;
                const stockId = food.stock_id; 
    
                const stockQuery = `
                    SELECT s.total_portions
                    FROM stock s
                    WHERE s.stock_id = $1;
                `;
                const stockResult = await client.query(stockQuery, [stockId]);
    
                if (stockResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({
                        success: false,
                        message: `No stock information found for food item with ID ${foodId}`
                    });
                }
    
                const totalPortions = stockResult.rows[0].total_portions;
    
                console.log('portions:', totalPortions);
                if (totalPortions <= 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock for food item with ID ${foodId}`
                    });
                }
    
                const newTotalPortions = totalPortions - 1;
    
                const newBoxes = Math.ceil(newTotalPortions / 20);
    
                const decrementStockQuery = `
                    UPDATE stock
                    SET total_portions = $1,
                    boxes = $2
                    WHERE stock_id = $3
                    RETURNING *;
                `;
                const updateStockResult = await client.query(decrementStockQuery, [newTotalPortions, newBoxes, stockId]);
    
                if (updateStockResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Not enough stock for food item with ID ${foodId}`
                    });
                }
            }
            
            console.log(`
                UPDATE customerorder
                SET status = 'fulfilled'
                WHERE order_id = $1
                RETURNING *;
            `);
            const updateOrderQuery = `
                UPDATE customerorder
                SET status = 'fulfilled'
                WHERE order_id = $1
                RETURNING *;
            `;
            const updateOrderResult = await client.query(updateOrderQuery, [orderId]);
    
            if (updateOrderResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
    
            await client.query('COMMIT');
  
            res.status(200).json({ success: true, message: 'Order has been fulfilled and stock updated' });
    
        } catch (err) {
            console.error('Error processing the order:', err);
            await client.query('ROLLBACK');
            return res.status(500).json({ success: false, message: 'Internal Server Error' });
        } finally {
            client.release(); 
        }
    });

    
app.get('/containerEdit', authentication.verifySession, authentication.managerPermissions, async (req, res) => {

    try {
        console.log("Connecting to the database...");
        const resultContainer = await pool.query('SELECT * FROM containerimage');

        res.render('containerEdit', { containers: resultContainer.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});

app.get('/newMenuItem', authentication.verifySession, authentication.managerPermissions, async (req, res) => {

    try {
        res.render('newMenuItem');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});

app.post('/newMenuItem', async (req, res) => {

    const { name, description, type, calories, image_url, seasonal, restrictions } = req.body;

    try {
        const countQuery = await pool.query('SELECT MAX(food_id) FROM food');
        const nextFoodId = countQuery.rows[0].max + 1;


        const result = await pool.query(
            `INSERT INTO food (food_id, food_name, description, itemtype, calories, seasonal,  dietary_restrictions, image) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [nextFoodId, name, description, type, calories, seasonal, restrictions, image_url]
        );

        res.redirect(`/menuEdit`);
    } catch (err) {
        console.error('Error saving menu item:', err);
        res.status(500).send('Error saving menu item');
    }
});

app.get('/containerEdit/:container_name/edit', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const { container_name } = req.params;

    try {
        const result = await pool.query('SELECT * FROM containerimage WHERE container_name = $1', [container_name]);
        const resultItem = result.rows[0];

        res.render('containerEditForm', {
            container: resultItem
        });
    } catch (err) {
        console.error('Error fetching ingredients:', err);
        res.status(500).send('Error fetching ingredients');
    }
});

app.get('/containerEdit/:container_name/edit', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const { container_name } = req.params;

    try {
        const result = await pool.query('SELECT * FROM containerimage WHERE container_name = $1', [container_name]);
        const resultItem = result.rows[0];

        res.render('containerEditForm', {
            container: resultItem
        });
    } catch (err) {
        console.error('Error fetching ingredients:', err);
        res.status(500).send('Error fetching ingredients');
    }
});

app.get('/employees', authentication.verifySession, authentication.managerPermissions, async (req, res) => {

    try {
        const result = await pool.query('SELECT * FROM employee');

        res.render('employees', {
            employees: result.rows, message: null
        });
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});

app.get('/employeeForm', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    try {
        res.render('employeeForm');
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});

app.post('/new-employee', async (req, res) => {
    try {
        console.log(req.body);
        const result = await pool.query(
            `INSERT INTO employee (employee_id, employee_firstname, employee_lastname, email, number, is_manager, orders_taken) 
             VALUES ($1, $2, $3, $4, $5, $6, 0)`,
            [req.body.id, req.body.firstname, req.body.lastname, req.body.email, req.body.number, req.body.is_manager]
        );
        res.status(200).send({result: 'employee successfully created'});
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});



app.get('/employees/:id', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const employeeId = req.params.id;

    try {
        console.log("Performing query: SELECT * FROM employee WHERE employee_id = $1");
        const employeeResult = await pool.query('SELECT * FROM employee WHERE employee_id = $1', [employeeId]);
        res.render('employeeEdit', { employee: employeeResult.rows[0] });
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});

app.post('/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { firstname, lastname, is_manager, email, number, employee_id } = req.body;

    try {
        await pool.query(
            'UPDATE employee SET employee_id = $7, employee_firstname = $1, employee_lastname = $2, is_manager = $3, email = $4, number = $5 WHERE employee_id = $6',
            [firstname, lastname, is_manager, email, number, id, employee_id]
        );
        res.redirect(`/employees/${employee_id}`);
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});

app.post('/employees/:id/delete', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const { id } = req.params;

    try {

        await pool.query('DELETE FROM employee WHERE employee_id = $1', [id]);

        const result = await pool.query('SELECT * FROM employee');

        res.render('employees', { employees: result.rows, message: "Successfully deleted employee." });
    } catch (err) {
        console.error('Error fetching employees:', err);
        res.status(500).send('Error fetching employees');
    }
});

app.post('/containerEdit/:container_name/edit', async (req, res) => {
    const { container_name } = req.params
    let { name, description, price, image } = req.body;
    price = (price) * 100;
    price = parseInt(price);

    try {
        await pool.query(
            'UPDATE containerimage SET container_name = $1, description = $2, price = $3, image = $4 WHERE container_name = $5',
            [name, description, price, image, container_name]
        );


        res.redirect(`/containerEdit/${name}/edit`);
    } catch (err) {
        console.error('Error adding ingredients:', err);

    }
});

app.get('/menuEdit/:food_id/ingredients', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const { food_id } = req.params;

    try {
        const foodQuery = await pool.query('SELECT * FROM food WHERE food_id = $1', [food_id]);
        const foodItem = foodQuery.rows[0];

        const ingredientsQuery = await pool.query(
            'SELECT stock.stock_id, stock.stock_name FROM foodxstock ' +
            'JOIN stock ON foodxstock.stock_id = stock.stock_id ' +
            'WHERE foodxstock.food_id = $1',
            [food_id]
        );
        const ingredients = ingredientsQuery.rows;


        const allStockQuery = await pool.query('SELECT * FROM stock');
        const allStockData = allStockQuery.rows;

        res.render('editIngredients', {
            foodItem,
            ingredients,
            allStockData
        });
    } catch (err) {
        console.error('Error fetching ingredients:', err);
        res.status(500).send('Error fetching ingredients');
    }
});

app.post('/menuEdit/:food_id/ingredients', async (req, res) => {
    const { food_id } = req.params;
    const { stock_id } = req.body;

    try {
        if (stock_id) {
            if (Array.isArray(stock_id)) {
                for (let id of stock_id) {
                    await pool.query(
                        'INSERT INTO foodxstock (food_id, stock_id) VALUES ($1, $2)',
                        [food_id, id]
                    );
                }
            } else {
                await pool.query(
                    'INSERT INTO foodxstock (food_id, stock_id) VALUES ($1, $2)',
                    [food_id, stock_id]
                );
            }
        }


        res.redirect(`/menuEdit/${food_id}/ingredients`);
    } catch (err) {
        console.error('Error adding ingredients:', err);

        res.redirect(`/menuEdit/${food_id}/ingredients`);
    }
});

app.post('/menuEdit/:food_id/ingredients/delete/:stock_id', async (req, res) => {
    const { food_id, stock_id } = req.params;

    try {

        await pool.query(
            'DELETE FROM foodxstock WHERE food_id = $1 AND stock_id = $2',
            [food_id, stock_id]
        );
        res.redirect(`/menuEdit/${food_id}/ingredients`);
    } catch (err) {
        console.error('Error deleting ingredient:', err);

        res.redirect(`/menuEdit/${food_id}/ingredients`);
    }
});

app.post('/menuEdit/:food_id/delete', async (req, res) => {
    const { food_id } = req.params;

    try {
        await pool.query('DELETE FROM foodxstock WHERE food_id = $1', [food_id]);
        await pool.query('DELETE FROM food WHERE food_id = $1', [food_id]);

        res.redirect('/menuEdit');
    } catch (err) {
        console.error('Error deleting menu item:', err);
        res.status(500).send('Error deleting menu item');
    }
});




app.get('/menuEdit/:id/edit', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    const itemId = req.params.id;

    try {
        console.log("Performing query: SELECT * FROM food WHERE food_id = $1");
        const foodResult = await pool.query('SELECT * FROM food WHERE food_id = $1', [itemId]);

        if (foodResult.rows.length > 0) {

            console.log("Performing query: SELECT stock.stock_id, stock.name FROM foodxstock JOIN stock ON foodxstock.stock_id = stock.stock_id WHERE foodxstock.food_id = $1");
            const stockResult = await pool.query(`
                SELECT stock.stock_id, stock.stock_name 
                FROM foodxstock
                JOIN stock ON foodxstock.stock_id = stock.stock_id
                WHERE foodxstock.food_id = $1
            `, [itemId]);

            const allStockResult = await pool.query('SELECT * FROM stock');

            const foodItem = foodResult.rows[0];
            const stockData = stockResult.rows;
            const allStockData = allStockResult.rows;

            res.render('menuEditForm', { foodItem, stockData, allStockData });
        } else {
            res.status(404).send('Food item not found');
        }
    } catch (err) {
        console.error('Error querying database', err);
        res.status(500).send('Database error');
    }
});

app.post('/deleteIngredient/:food_id/:stock_id', async (req, res) => {
    const { food_id, stock_id } = req.params;

    try {

        await pool.query('DELETE FROM foodxstock WHERE food_id = $1 AND stock_id = $2', [food_id, stock_id]);

        res.redirect('back');
    } catch (err) {
        console.error('Error deleting ingredient relationship:', err);
        res.status(500).send('Database error');
    }
});




app.post('/menuEdit/:id', async (req, res) => {
    const itemId = req.params.id;
    const { name, description, restrictions, type, calories, image, seasonal } = req.body;

    try {
        await pool.query(
            'UPDATE food SET food_name = $1, description = $2, dietary_restrictions = $3, itemtype = $4, calories = $5, image = $6, seasonal = $7 WHERE food_id = $8',
            [name, description, restrictions, type, calories, image, seasonal, itemId]
        );


        res.redirect(`/menuEdit/${itemId}/edit`);
    } catch (err) {
        console.error('Error updating food item:', err);
        res.status(500).send('Database error');
    }
});

app.get('/checkStock/:itemID/:itemtype', async (req, res) => {
    const itemID = parseInt(req.params.itemID);
    const itemtype = req.params.itemtype; // Correctly extract itemtype from the route parameters

    if (isNaN(itemID)) {
        return res.status(400).json({ success: false, message: 'Invalid item ID' });
    }

    try {
        // Step 1: Fetch the stock_id(s) from the foodxstock junction table based on the food item ID
        const foodxstockQuery = `
            SELECT stock_id
            FROM foodxstock
            WHERE food_id = $1
        `;
        const foodxstockResult = await pool.query(foodxstockQuery, [itemID]);

        if (foodxstockResult.rows.length === 0) {
            return res.json({ success: true, isInStock: false }); // No stock entries found
        }

        const stockIds = foodxstockResult.rows.map(row => row.stock_id);
        const stockQuery = `
            SELECT total_portions
            FROM stock
            WHERE stock_id = ANY($1::int[])
        `;
        const stockResult = await pool.query(stockQuery, [stockIds]);

        let isInStock = false; 


        if (itemtype !== 'entree') {
            isInStock = stockResult.rows.every(stock => stock.total_portions > 0); 
        } else {
            isInStock = stockResult.rows.every(stock => stock.total_portions > 2); 
        }
        console.log(isInStock);

        return res.json({ success: true, isInStock }); // Return true/false based on stock availability
    } catch (error) {
        console.error('Error in checkStock route:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});


app.post('/menuEditAddItem/:food_id', async (req, res) => {
    const { food_id } = req.params;
    const { stock_id } = req.body;
    console.log('stock_id:', stock_id);

    try {
        if (!stock_id) {
            return res.redirect(`/menuEdit/${food_id}/edit`);
        }

        if (stock_id) {
            console.log('added!')
            await pool.query(
                'INSERT INTO foodxstock (food_id, stock_id) VALUES ($1, $2)',
                [food_id, stock_id]
            );
        }

        res.redirect(`/menuEdit/${food_id}/edit`);
    } catch (err) {
        console.error('Error adding ingredients to foodxstock:', err);
        res.status(500).send('Database error');
    }
});

app.delete('/deleteItem/:orderId', (req, res) => {
    const orderId = req.params.orderId;

    // Logic to delete the item from the cart (example)
    const cartIndex = req.session.cart.findIndex(item => item[0] == orderId);
    if (cartIndex !== -1) {
        req.session.cart.splice(cartIndex, 1); // Remove the item from the cart
        res.status(200).json({ message: 'Item deleted successfully' });
    } else {
        res.status(404).json({ message: 'Item not found' });
    }
});
const fetch = require('node-fetch');
app.get('/foodMapping', async (req, res) => {
    const query = `SELECT food_id, food_name FROM food`;
    try {
        const result = await pool.query(query);
        const foodMapping = {};
        result.rows.forEach(row => {
            foodMapping[row.food_name] = row.food_id;
        });
        res.json(foodMapping);
    } catch (error) {
        console.error('Error fetching food mapping:', error);
        res.status(500).send('Failed to retrieve food mapping');
    }
});
async function fetchFoodMapping() {
    try {
        const response = await fetch('http://localhost:3000/foodMapping'); // Full URL required in Node.js
        if (!response.ok) {
            throw new Error('Failed to fetch food mapping');
        }
        const foodMapping = await response.json();
        //console.log('Food Mapping:', foodMapping);
        return foodMapping;
    } catch (error) {
        console.error('Error fetching food mapping:', error);
    }
}

app.post('/checkIngredients', async (req, res) => {
    const { cart } = req.body; // Get cart items from the request body
    try {
        const unavailableItems = [];

        for (const item of cart) {
            // Query to get the stock details for the ingredients of the food item
            const foodStockQuery = `
                SELECT stock.stock_id, stock.stock_name, stock.total_portions AS portions
                FROM foodxstock fxs
                JOIN stock ON fxs.stock_id = stock.stock_id
                WHERE fxs.food_id = (SELECT food_id FROM food WHERE food_name = $1)
            `;

            // Perform stock query based on container type
            let stockResult = null;
            const containerName = item[2];
            if (containerName == "Appetizer") {
                const appetizerItem = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(a => a.trim()) : (item[3] || []);
                for (const appetizer of appetizerItem) {
                    if (appetizer) {
                        stockResult = await pool.query(foodStockQuery, [appetizer]);
                        // Check each ingredient's total_portions for the food item
                        for (const stock of stockResult.rows) {
                            if (stock.portions <= 0) {
                                unavailableItems.push(appetizer);
                                break; // Stop checking further ingredients for this food item
                            }
                        }
                    } else {
                        console.warn(`Unknown food item: ${appetizer}`);
                    }
                }
            } else if (containerName == "Drink") {
                const drinkItem = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(a => a.trim()) : (item[3] || []);
                for (const drink of drinkItem) {
                    if (drink) {
                        stockResult = await pool.query(foodStockQuery, [drink]);
                        // Check each ingredient's total_portions for the food item
                        for (const stock of stockResult.rows) {
                            if (stock.portions <= 0) {
                                unavailableItems.push(drink);
                                break; // Stop checking further ingredients for this food item
                            }
                        }
                    } else {
                        console.warn(`Unknown food item: ${drink}`);
                    }
                }
            } else if (containerName == "Bigger Plate") {
                const foodItems = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(f => f.trim()) : (item[3] || []);
                const sideItem = (item[4] && typeof item[4] === 'string') ? item[4].split(',').map(s => s.trim()) : (item[4] || []);
                const allFoodItems = [...foodItems, ...sideItem];
                for (const item of allFoodItems) {
                    if (item) {
                        stockResult = await pool.query(foodStockQuery, [item]);
                        // Check each ingredient's total_portions for the food item
                        for (const stock of stockResult.rows) {
                            if (stock.portions <= 0) {
                                unavailableItems.push(item);
                                break; // Stop checking further ingredients for this food item
                            }
                        }
                    } else {
                        console.warn(`Unknown food item: ${item}`);
                    }
                }
            } else if (containerName == "Bowl") {
                const foodItem = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(f => f.trim()) : (item[3] || []);
                const sideItem = (item[4] && typeof item[4] === 'string') ? item[4].split(',').map(s => s.trim()) : (item[4] || []);
                const allFoodItems = [...foodItem, ...sideItem];
                for (const item of allFoodItems) {
                    if (item) {
                        stockResult = await pool.query(foodStockQuery, [item]);
                        // Check each ingredient's total_portions for the food item
                        for (const stock of stockResult.rows) {
                            if (stock.portions <= 0) {
                                unavailableItems.push(item);
                                break; // Stop checking further ingredients for this food item
                            }
                        }
                    } else {
                        console.warn(`Unknown food item: ${item}`);
                    }
                }
            } else if (containerName == "Plate") {
                const foodItems = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(f => f.trim()) : (item[3] || []);
                const sideItem = (item[4] && typeof item[4] === 'string') ? item[4].split(',').map(s => s.trim()) : (item[4] || []);
                const allFoodItems = [...foodItems, ...sideItem];
                for (const item of allFoodItems) {
                    if (item) {
                        stockResult = await pool.query(foodStockQuery, [item]);
                        // Check each ingredient's total_portions for the food item
                        for (const stock of stockResult.rows) {
                            if (stock.portions <= 0) {
                                unavailableItems.push(item);
                                break; // Stop checking further ingredients for this food item
                            }
                        }
                    } else {
                        console.warn(`Unknown food item: ${item}`);
                    }
                }
            } else if (containerName == "A-La-Carte") {
                const foodItem = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(f => f.trim()) : (item[3] || []);
                for (const item of foodItem) {
                    if (item) {
                        stockResult = await pool.query(foodStockQuery, [item]);
                        // Check each ingredient's total_portions for the food item
                        for (const stock of stockResult.rows) {
                            if (stock.portions <= 0) {
                                unavailableItems.push(item);
                                break; // Stop checking further ingredients for this food item
                            }
                        }
                    } else {
                        console.warn(`Unknown food item: ${item}`);
                    }
                }
            }
        }

        // If there are unavailable items, send them back to the client
        if (unavailableItems.length > 0) {
            return res.status(200).json({ unavailable: unavailableItems });
        }

        // Otherwise, send success
        res.status(200).json({ unavailable: [] });
    } catch (error) {
        console.error('Error checking stock:', error);
        res.status(500).send('Internal Server Error');
    }
});
app.post('/pushOrder', async (req, res) => {
    const { cart, order_id, employee_id, date, time, is_in_process, status } = req.body;

    const insertOrderQuery = `
        INSERT INTO customerorder (price, order_id, employee_id, order_date, order_time, is_in_process, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const insertContainerQuery = `
        INSERT INTO container (container_id, container_name, container_price)
        VALUES ($1, $2, $3)
    `;

    const insertOrderContainerQuery = `
        INSERT INTO orderxcontainer (order_id, container_id)
        VALUES ($1, $2)
    `;

    const insertContainerFoodQuery = `
        INSERT INTO containerxfood (container_id, food_id)
        VALUES ($1, $2)
    `;

    const foodMapping = await fetchFoodMapping();
    if (!foodMapping) {
        console.error('Cannot process order without food mapping');
        return;
    }

    try {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Insert into `customerorder`
            const totalPrice = cart.reduce((sum, item) => sum + item[1], 0); // Calculate total price
            await client.query(insertOrderQuery, [
                totalPrice,
                order_id,
                employee_id,
                date,
                time,
                is_in_process, 
                status
            ]);

            // Get the starting container_id dynamically
            let containerId = await getNextContainerId(client);

            // Process each container
            for (const item of cart) {
                const containerType = item[2]; // Get container type (e.g., drink, bowl)
                const containerPrice = item[1];
                // Entrees
                const foodItems = (item[3] && typeof item[3] === 'string') ? item[3].split(',').map(f => f.trim()) : (item[3] || []);
                // Sides
                const sideItems = (item[4] && typeof item[4] === 'string') ? item[4].split(',').map(s => s.trim()) : (item[4] || []);
                // Appetizers
                const appetizerItems = (item[5] && typeof item[5] === 'string') ? item[5].split(',').map(a => a.trim()) : (item[5] || []);

                // Insert container
                await client.query(insertContainerQuery, [
                    containerId,
                    containerType,
                    containerPrice,
                ]);

                // Link container to order
                await client.query(insertOrderContainerQuery, [order_id, containerId]);

                // Map food items for the container
                const allFoodItems = [...foodItems, ...sideItems, ...appetizerItems];
                for (const food of allFoodItems) {
                    const foodId = foodMapping[food];
                    if (foodId) {
                        await client.query(insertContainerFoodQuery, [containerId, foodId]);
                    } else {
                        console.warn(`Unknown food item: ${food}`);
                    }
                }

                containerId++; // Increment container ID for the next container
            }

            await client.query('COMMIT');
            req.session.cart = []; // Clear session-based cart
            res.status(200).json({ message: 'Order added successfully' });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('Transaction failed:', err);
            res.status(500).send('Failed to add order to database');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error acquiring client from pool:', err);
        res.status(500).send('Failed to connect to database');
    }
});
// Helper function to get the next container_id
async function getNextContainerId(client) {
    const result = await client.query('SELECT MAX(container_id) AS max_id FROM container');
    return result.rows[0].max_id ? result.rows[0].max_id + 1 : 1; // Start with 1 if no containers exist
}
const client = require('./database');
app.post('/decrementStock', async (req, res) => {
    const { cart } = req.body;

    try {
        await client.query('BEGIN'); // Start a transaction

        for (const container of cart) {
            // Entrees
            const foodItems = (container[3] && typeof container[3] === 'string') ? container[3].split(',').map(f => f.trim()) : (container[3] || []);
            // Sides
            const sideItems = (container[4] && typeof container[4] === 'string') ? container[4].split(',').map(s => s.trim()) : (container[4] || []);
            // Appetizers
            const appetizerItems = (container[5] && typeof container[5] === 'string') ? container[5].split(',').map(a => a.trim()) : (container[5] || []);
            const items = [...foodItems, ...sideItems, ...appetizerItems].filter(item => item); // Combine and filter non-null items

            for (const item of items) {
                // Fetch stock_id for the food item
                const foodStockQuery = `
                    SELECT stock_id
                    FROM foodxstock
                    WHERE food_id = (
                        SELECT food_id FROM food WHERE food_name = $1
                    );
                `;
                const foodStockResult = await client.query(foodStockQuery, [item]);
                // Stock does not exist for a food item
                if (foodStockResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(404).json({
                        success: false,
                        message: `Stock information not found for food item: ${item}`,
                    });
                }

                const stockId = foodStockResult.rows[0].stock_id;
                // Fetch current stock levels
                const stockQuery = `
                    SELECT total_portions
                    FROM stock
                    WHERE stock_id = $1;
                `;
                const stockResult = await client.query(stockQuery, [stockId]);
                // No portions exist for the selected stock
                if (stockResult.rowCount === 0 || stockResult.rows[0].total_portions <= 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for food item: ${item}`,
                    });
                }

                const totalPortions = stockResult.rows[0].total_portions;
                const newTotalPortions = totalPortions - 1;
                const newBoxes = Math.ceil(newTotalPortions / 20);

                // Update the stock
                const decrementStockQuery = `
                    UPDATE stock
                    SET total_portions = $1,
                        boxes = $2
                    WHERE stock_id = $3
                    RETURNING *;
                `;
                const updateStockResult = await client.query(decrementStockQuery, [newTotalPortions, newBoxes, stockId]);

                if (updateStockResult.rowCount === 0) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({
                        success: false,
                        message: `Failed to update stock for food item: ${item}`,
                    });
                }
            }
        }

        await client.query('COMMIT'); // Commit the transaction
        res.status(200).json({
            success: true,
            message: 'Stock successfully decremented.',
        });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback in case of an error
        console.error('Error decrementing stock:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating stock.',
        });
    }
});



const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.get('/inventory', authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    try {
        console.log("Connecting to the database...");

        console.log("Performing query: SELECT * FROM stock ORDER BY stock_id ASC;");
        const result = await pool.query('SELECT * FROM stock ORDER BY stock_id ASC');

        res.render('inventory', { food: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});


app.get('/inventory/add', async (req, res) => {

    try {
        
        res.render('inventoryNew');
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Failed to add inventory item');
    }
});
app.post('/inventory/add', async (req, res) => {
    const { stock_name, boxes, total_portions, minimum_boxes } = req.body;

    // Query to count the existing rows in the stock table
    const selectQuery = await pool.query(`SELECT * FROM stock`);
    const countQuery = `SELECT COUNT(*) FROM stock`;

    // Query to insert a new stock item
    const insertQuery = `
        INSERT INTO stock (stock_id, stock_name, boxes, total_portions, minimum_boxes) 
        VALUES ($1, $2, $3, $4, $5)
    `;

    try {
        // First, count the number of rows in the stock table to calculate the next stock_id
        const countResult = await pool.query(countQuery);
        const nextStockId = parseInt(countResult.rows[0].count) + 1; // nextStockId = current row count + 1

        // Prepare the params for the insert query
        const params = [nextStockId, stock_name, boxes, boxes * 20, minimum_boxes];

        console.log('Executing query:', insertQuery, 'with params:', params);

        // Insert the new stock item into the table
        await pool.query(insertQuery, params);

        res.redirect(`/inventory`);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Failed to adds inventory item');
    }
});


// Route to edit an inventory item
app.get('/inventory/edit/:index', async (req, res) => {
    const id = req.params.index; // Get the stock_id from the URL parameter

    const query = `
        SELECT * FROM stock WHERE stock_id = $1;
    `;

    try {
        // Execute the query to fetch data from the stock table
        const result = await pool.query(query, [id]);

        // If no stock item is found, send a 404 response
        if (result.rowCount === 0) {
            return res.status(404).send('Stock item not found');
        }

        // Pass the stock data to the 'inventoryEdit' template for rendering
        res.render('inventoryEdit', { stock: result.rows[0] });

    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Failed to retrieve inventory item');
    }
});

app.post('/inventory/edit/:id', async (req, res) => {
    const { stock_name, boxes, total_portions, minimum_boxes } = req.body;
    const stockId = req.params.id; 
    if (isNaN(stockId)) {
        return res.status(400).json({ success: false, message: 'Invalid stock ID' });
    }

    const query = `
        UPDATE stock
        SET stock_name = $1, boxes = $2, total_portions = $3, minimum_boxes = $4
        WHERE stock_id = $5
    `;

    try {
        await pool.query(query, [stock_name, parseInt(boxes), parseInt(boxes) * 20, parseInt(minimum_boxes), stockId]);
        res.redirect(`/inventory/edit/${stockId}`);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Failed to update inventory item');
    }
});




app.post('/inventory/delete/:index', async (req, res) => {
    const { index } = req.params;
    
        try {
            await pool.query('DELETE FROM stock WHERE stock_id = $1', [index]);

            res.redirect('/inventory');
        } catch (err) {
            console.error('Error fetching complaints:', err);
            res.status(500).send('Error fetching complaints');
        }
});

// Route to purchase stock (increase box count)
app.put('/inventory/purchase/:index', async (req, res) => {
    const { total_portions } = req.body;
    const boxes = Math.ceil(total_portions / 20);

    const query = `
        UPDATE stock 
        SET boxes = $1, total_portions = $2
        WHERE stock_id = $3
    `;
    const params = [boxes, total_portions, +req.params.index];

    console.log('Executing query:', query, 'with params:', params);

    try {
        await pool.query(query, params);
        res.sendStatus(200);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).send('Failed to update stock');
    }
});

app.get('/complaints', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM complaints'); 
        res.render('complaints', { complaints: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

app.post('/complaints/:id/delete', async (req, res) => {
   
        const { id } = req.params;
    
        try {
    
            await pool.query('DELETE FROM complaints WHERE complaint_id = $1', [id]);
    
            const result = await pool.query('SELECT * FROM complaints');
    
            res.redirect('/complaints');
        } catch (err) {
            console.error('Error fetching complaints:', err);
            res.status(500).send('Error fetching complaints');
        }
  
});


app.get('/menu', async (req, res) => {
    console.log("Accessing the /menu route..."); // Log when accessing the route
    try {
        const result = await pool.query('SELECT * FROM food'); // Ensure this table exists
        res.render('menu', { food: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});
//new complaint form TODO
app.get('/complaintForm', async (req, res) => {
    try {
        res.render('complaintForm'); // Load the complaint form
    } catch (err) {
        console.error(err);
        res.status(500).render('error', { message: 'Unable to load the complaint form.' }); // Use a custom error page
    }
});

app.get('/display/:name', async (req, res) => {
    const containerName = req.params.name;
    let result = null;
    let containerPrice = null;

    try {
        console.log("Connecting to the database...");
        console.log(`Executing query for container: ${containerName}`);

        // Fetch food items based on container type
        if (['Plate', 'Bowl', 'Bigger Plate', 'A-La-Carte'].includes(containerName)) {
            result = await pool.query("SELECT * FROM food WHERE itemtype IN ('side', 'entree', 'both')");
        } else if (containerName === 'Appetizer') {
            result = await pool.query("SELECT * FROM food WHERE itemtype IN ('appetizer')");
        } else if (containerName === 'Drink') {
            result = await pool.query("SELECT * FROM food WHERE itemtype IN ('drink')");
        } else {
            throw new Error("Invalid container name (check capitalization)");
        }

        // Fetch container price based on container name
        const containerResult = await pool.query(
            "SELECT price FROM containerimage WHERE container_name = $1",
            [containerName]
        );

        // Get the container price
        containerPrice = containerResult.rows[0] ? containerResult.rows[0].price : null;

        // Render the display page
        res.render('display', { food: result.rows, containerName, containerPrice });

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    } finally {
        console.log("Connection closed.");
    }
});


app.get("/reports", authentication.verifySession, authentication.managerPermissions, async (req, res) => {
    try {
        // Fetch food names from the database (no ID, just food_name)
        const foodResult = await pool.query('SELECT food_name FROM food');
        const foodOptions = foodResult.rows.map(row => row.food_name);

        // Fetch ingredient names from the database
        const ingredientResult = await pool.query('SELECT stock_name FROM stock');
        const ingredientOptions = ingredientResult.rows.map(row => row.stock_name);


         // Define time options (10:00 AM to 10:00 PM)
         const timeOptions = [
            '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', 
            '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'
        ];


        // Render the page with empty data for reports initially
        res.render('report', {
            foodReport1: [], // Empty array for sales report
            foodReport2: [], // Empty array for productUsage report
            foodReport3: [], // Empty array for daily report
            foodReport5: await restockReport(), // Empty array for restock report
            foodOptions,
            ingredientOptions,
            timeOptions
        });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});


app.post('/generate-report', async (req, res) => {

    try {

        const { startDate, endDate, startTime, endTime, reportType } = req.body;
        let salesReport = null;
        let productUsageReport = null;
        let dailyReport = null;
        if (reportType == 'sales') {
            console.log("Calling sales with:", { startDate, endDate, startTime, endTime });
            salesReport = await sales(startDate, endDate, startTime, endTime);

        } else if (reportType == 'sales') {
            console.log("Calling salesReport with:", { startDate, endDate, filter });

            salesReport = await sales(startDate, endDate, filter);
        } else if (reportType == 'productUsage') {
            console.log("Calling productUsageReport with:", { startDate, endDate, startTime, endTime });
            productUsageReport = await productUsage(startDate, endDate, startTime, endTime);
        } else if (reportType == 'xReport') {
            console.log("Calling daily for xReport");
            dailyReport = await daily('xReport');
        } else if (reportType == 'zReport') {
            console.log("Calling daily for zReport");
            dailyReport = await daily('zReport');
        }

        res.json({
            salesReport,
            productUsageReport,
            dailyReport
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});




app.post('/translate', async (req, res) => {
    const {text, targetLanguage} = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing text' });
    }
    if (!targetLanguage || typeof targetLanguage !== 'string') {
        return res.status(400).json({ error: 'Invalid or missing targetLanguage' });
    }

    try {
        const translatedText = await translateText(text, targetLanguage);
        res.json({ translatedText });
    } catch (error) {
        console.error('Error during translation:', error);
        res.status(500).json({ error: 'Translation error', details: error.message });
    }
});


app.get('/login', async (req, res) => {
    try {
        res.render('login');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    } finally {
        console.log("Connection closed.");
    }
});


app.get("*", async (req, res) => {
    res.status(404).render("err404");
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});