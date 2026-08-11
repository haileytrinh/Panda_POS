const pool = require('./database');

class Container {
  constructor(container_name, foodIDs, id = -1) {
    this.name = container_name;
    switch (container_name) {
      case 'Appetizer':
        this.price = 200;
        break;
      case 'Drink':
        this.price = 210;
        break;
      case 'Bigger Plate':
        this.price = 1130;
        break;
      case 'Bowl':
        this.price = 830;
        break;
      case 'Plate':
        this.price = 980;
        break;
      case 'A la Carte':
        this.price = 440;
        break;
      default:
        throw Error('Invalid container name (check capitalization)');
    }
    this.id = id;
    this.foodIDs = foodIDs;
  }

  async pushToDB() {
    // Do nothing if this already exists in the database
    if (id != -1) {
      return -1;
    }
    let query =
        'INSERT INTO container (container_name, container_price) VALUES (' +
        this.name + ', ' + this.price + ') RETURNING container_id;';
    let result = await pool.query(query);
    this.id = result.rows[0].container_id;
    let itemQuery = 'INSERT INTO containerxfood (container_id, food_id) VALUES '
    for (var i = 0; i < this.foodIDs.length; i++) {
      itemQuery += '(' + this.id + ', ' + foodIDs[i] + ')';
      if (i < this.foodIDs.length - 1) {
        itemQuery += ', ';
      }
    }
    itemQuery += ';';
    await pool.query(itemQuery);
    return this.id;
  }
}

module.exports = Container;