const pool = require('./database');

const convertToMilitaryTime = (time) => {
    // Create a regex to handle 12-hour format with AM/PM
    const regex = /^(1[0-2]|[1-9]):([0-5][0-9]) (AM|PM)$/;
    const match = time.match(regex);
  
    if (!match) {
      throw new Error('Invalid time format');
    }
  
    let [_, hour, minute, period] = match;
    hour = parseInt(hour);
    minute = parseInt(minute);
  
    if (period === 'AM' && hour === 12) {
      hour = 0; // 12 AM is 00:00 in 24-hour time
    } else if (period === 'PM' && hour !== 12) {
      hour += 12; // Convert PM hour to 24-hour time
    }
  
    return hour;
  };

const sales = async (startDate, endDate, startTime, endTime) => {

    // Convert startTime and endTime to military time
    const startMilitaryTime = convertToMilitaryTime(startTime);
    const endMilitaryTime = convertToMilitaryTime(endTime);
  
    // Start building the query
    let query = `
          SELECT 
              container.container_name AS container_type, 
              COUNT(orderxcontainer.container_id) AS quantity_sold, 
              SUM(container.container_price) AS total_revenue
          FROM 
              customerorder
          INNER JOIN 
              orderxcontainer ON customerorder.order_id = orderxcontainer.order_id
          INNER JOIN 
              container ON orderxcontainer.container_id = container.container_id
          WHERE 
              customerorder.order_date BETWEEN TO_DATE('${startDate}', 'MM/DD/YYYY') AND TO_DATE('${endDate}', 'MM/DD/YYYY')
              AND EXTRACT(HOUR FROM customerorder.order_time) BETWEEN ${startMilitaryTime} AND ${endMilitaryTime}
          GROUP BY 
              container.container_name
          ORDER BY 
              container.container_name;
    `;
  
    try {
      const queryOutput = await pool.query(query);
    //   console.log('Query:', query);  // Log the query before executing
      return queryOutput.rows; // Returns array of {container_type, quantity_sold, total_revenue}
    } catch (err) {
      console.error("Error executing query:", err);
      throw err;
    }
  };
  

const productUsage = async (startDate, endDate, startTime, endTime) => { // ACTUALLY PRODUCT USAGE

    // Convert startTime and endTime to military time
    const startMilitaryTime = convertToMilitaryTime(startTime);
    const endMilitaryTime = convertToMilitaryTime(endTime);

    let query = `SELECT 
            stock.stock_name AS ingredient, 
            SUM(COALESCE(food.qty_ingredients, 0)) AS quantity_used
        FROM 
            customerorder
        INNER JOIN 
            orderxcontainer ON customerorder.order_id = orderxcontainer.order_id 
        INNER JOIN 
            container ON container.container_id = orderxcontainer.container_id
        INNER JOIN 
            containerxfood ON container.container_id = containerxfood.container_id
        INNER JOIN 
            food ON food.food_id = containerxfood.food_id
        INNER JOIN 
            foodxstock ON food.food_id = foodxstock.food_id
        INNER JOIN 
            stock ON stock.stock_id = foodxstock.stock_id
        WHERE 
            customerorder.order_date BETWEEN TO_DATE('${startDate}', 'MM/DD/YYYY') AND TO_DATE('${endDate}', 'MM/DD/YYYY')
            AND EXTRACT(HOUR FROM customerorder.order_time) BETWEEN ${startMilitaryTime} AND ${endMilitaryTime}

        GROUP BY 
            stock.stock_name
        ORDER BY 
            stock.stock_name;
`;

        try {
            const queryOutput = await pool.query(query);
            // console.log('Query:', query);  // Log the query before executing
        
            return queryOutput.rows; 
        } catch (err) {
            console.error("Error executing query:", err);
            throw err;
        }
};

const daily = async (reportType) => {
    let query;
    
    // Determine the query based on the reportType
    if (reportType === 'xReport') {
        query = `SELECT 
        EXTRACT(HOUR FROM order_time) AS hour, 
        COUNT(order_id) AS sales, 
        SUM(price) AS price
    FROM 
        customerorder 
    WHERE 
        order_date = CURRENT_DATE
    GROUP BY 
        hour 
    ORDER BY 
        hour ASC;
        `;
    } else if (reportType === 'zReport') {
        query = `
        SELECT 
            EXTRACT(HOUR FROM CURRENT_TIME AT TIME ZONE 'CST') as hour, 
            COUNT(order_id) AS sales, 
            SUM(price) AS price
        FROM 
            customerorder
        WHERE 
            order_date = CURRENT_DATE;
        `;
    } else {
        throw new Error('Invalid report type');
    }

    // Execute the query
    const queryOutput = await pool.query(query);

    // Format the result
    let result = [];
    for (const row of queryOutput.rows) {
        result.push({
            hour: row.hour, 
            sales: row.sales, 
            price: row.price
        });
    }

    return result;
};


const restockReport = async () => {
    const query = `SELECT 
        stock_name AS ingredient, 
        boxes AS quantity, 
        minimum_boxes AS minimum 
    FROM 
        stock
    WHERE 
        boxes < minimum_boxes
    GROUP BY 
        stock_id, stock_name, boxes, minimum_boxes
    ORDER BY 
        stock_id ASC;`;

  const queryOutput = await pool.query(query);
  let result = [];
  for (const row of queryOutput.rows) {
    result.push({
      ingredient: row.ingredient,
      quantity: row.quantity,
      minimum: row.minimum
    });
  }
  return result;
};

module.exports =
    [sales, productUsage, daily, restockReport];

