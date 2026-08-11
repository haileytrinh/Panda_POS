const pool = require('./database');

const getFoodIDs = async (names) => {
  console.log("Fetching food IDs...");
  return await Promise.all(names.map(async (name) => {
      try {
          const rows = (await pool.query('SELECT food_id FROM food WHERE food_name=$1;', [name])).rows;
          if (rows.length < 1) {
              console.log(`No food found for: ${name}`);
              return null;
          } else {
              return rows[0].food_id;
          }
      } catch (error) {
          console.error("Error fetching food IDs:", error);
          return null;
      }
  }));
};

const foodIDEndpoint = async (req, res) => {
    try {
        const names = req.body.names;
        const ids = await getFoodIDs(names);
        res.status(200).send({ids: ids});
    } catch (error) {
        res.status(400).send(error.message);
    }
}

module.exports = { foodIDEndpoint };