const {OAuth2Client} = require('google-auth-library');
const express = require('express');
const pool = require('./database');

class Session {
  constructor(token, userID, expirationTime, isManager) {
    this.token = token;
    this.userID = userID;
    this.isManager = isManager;
    this.expirationTime = expirationTime;
  }
}

var activeSessions = [];
const oauthClient = new OAuth2Client(
    process.env.OAUTH2_CLIENT_ID, process.env.OAUTH2_CLIENT_SECRET);

const verifySession = (req, res, next) => {
  const token = req.cookies.sessionToken;
  activeSessions = activeSessions.filter(
      (session) => {return session.expirationTime >= Date.now()});
  var isValid = false;
  for (const session of activeSessions) {
    if (session.token == token) {
      next();
      isValid = true;
    }
  }
  if (!isValid) {
    res.status(401).redirect('/login');
  }
};

const managerPermissions = (req, res, next) => {
  const token = req.cookies.sessionToken;
  var isValid = false;
  for (const session of activeSessions) {
    if (session.token == token && session.isManager) {
      next();
      isValid = true;
    }
  }
  if (!isValid) {
    res.status(401).redirect('/login');
  }
}

const createSession = async (req, res) => {
  try {
    const ticket = oauthClient.verifyIdToken({idToken: req.body.idToken});
    const payload = (await ticket).getPayload();

    const queryResult = await pool.query('SELECT * FROM employee WHERE employee_id=\'' + payload.sub + '\';');
    if (queryResult.rowCount < 1) {
      res.status(401).send('Nonexistent user');
      return;
    }

    const token = new Uint32Array(1);
    crypto.getRandomValues(token);
    activeSessions.push(new Session(
        token[0].toFixed(0), payload.sub, 1000 * payload.exp - 1, queryResult.rows[0].is_manager));
    res.set({
      'Set-Cookie': 'sessionToken=' + token[0].toFixed(0) + '; Expires=' +
          new Date(1000 * payload.exp - 1).toUTCString() + '; Secure; HttpOnly'
    });
    res.status(200).send('Session created successfully');
  } catch (e) {
    console.log(e.message);
    res.status(401).send('Session creation failed');
  }
};

const getGoogleID = async (req, res) => {
  try {
    const ticket = oauthClient.verifyIdToken({idToken: req.body.idToken});
    const payload = (await ticket).getPayload();
    res.status(200).send({id: payload.sub, email: payload.email});
  } catch (e) {
    console.log(e.message);
    res.status(401).send('Session creation failed');
  }
};

const doLogOut = async (req, res) => {
  const token = req.cookies.sessionToken;
  activeSessions =
      activeSessions.filter((session) => {return session.token != token});
  res.redirect('/');
};

module.exports = {
  verifySession,
  createSession,
  doLogOut,
  managerPermissions,
  getGoogleID
};