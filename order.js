const pool = require('./database');

class Order {
  constructor(
      containers, employeeID = -1, id = -1, when = new Date(Date.now())) {
    this.containers = containers;
    this.employeeID = employeeID;
    this.orderDate =
        when.getFullYear() + '-' + when.getMonth() + '-' + when.getDate();
    this.orderTime =
        when.getHours() + ':' + when.getMinutes() + ':' + when.getSeconds();
    this.id = id;
  }

  get price() {
    let price = 0;
    for (const container of this.containers) {
      price += container.price;
    }
    return price;
  }

  async pushToDB() {
    // Do nothing if this already exists in the database
    if (id != -1) {
      return;
    }
    let query =
        'INSERT INTO customerorder (price, employee_id, order_date, order_time, is_in_process) VALUES (';
    query += this.price + ', ' + this.employeeID + ', DATE ' + this.orderDate +
        ', TIME ' + this.orderTime + ', TRUE) RETURNING order_id;';
    let result = await pool.query(query);
    this.id = result.rows[0].order_id;
    crossRefQuery =
        'INSERT INTO orderxcontainer (order_id, container_id) VALUES ';
    for (let i = 0; i < this.containers.length; i++) {
      crossRefQuery +=
          '(' + this.id + ', ' + (await containers[i].pushToDB()) + ')';
      if (i < this.containers.length - 1) {
        crossRefQuery += ', ';
      }
    }
    crossRefQuery += ';';
    await pool.query(crossRefQuery);
  }

  async finishOrder() {
    if (id == -1) {
      throw Error('Order must be pushed to database before it can be finished');
    }
    let query = 'UPDATE customerorder SET is_in_process=FALSE WHERE order_id=' +
        this.id + ';';
  }
}

const getInProcessOrders = async () => {
  let result = [];
  const query = 'SELECT * FROM customerorder WHERE is_in_process=TRUE;';
  const orderRows = await pool.query(query);
  for (const row of orderRows.rows) {
    let containers = [];
    const containerRows = await pool.query(
        'SELECT container_name, food_id, container.container_id FROM container\n' +
        'INNER JOIN orderxcontainer\n' +
        'ON container.container_id=orderxcontainer.container_id\n' +
        'INNER JOIN containerxfood\n' +
        'ON container.container_id=containerxfood.container_id\n' +
        'WHERE orderxcontainer.order_id=' + row.order_id + ';');
    for (const containerRow of containerRows.rows) {
      if (containers[containerRow.container_id] == undefined) {
        containers[containerRow.container_id] = new Container(
            containerRow.container_name, [containerRow.food_id],
            containerRow.container_id);
      } else {
        containers[containerRow.container_id].foodIDs.push(
            containerRow.food_id);
      }
    }
    containers = containers.filter(n => n);  // compact the array
    result.push(new Order(
        containers, row.employee_id, row.order_id,
        new Date(row.order_date + ' ' + row.order_time)));
  }
  return result;
};

module.exports = [Order, getInProcessOrders];