const mongoose = require('mongoose');
const { SocksProxyAgent } = require('socks-proxy-agent');
const dotenv = require('dotenv');
dotenv.config();

const fixieData = process.env.FIXIE_SOCKS_HOST.split(new RegExp('[:/@]+'));
const proxyUrl = `socks5://${fixieData[0]}:${fixieData[1]}@${fixieData[2]}:${fixieData[3]}`;
const proxyAgent = new SocksProxyAgent(proxyUrl);

const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  driverInfo: {
    name: 'nodejs',
    version: process.version,
    platform: process.platform,
    proxy: proxyAgent
  }
};

mongoose.connect(process.env.MONGODB_URI, mongooseOptions)
  .then(() => console.log('Connected to database'))
  .catch(error => {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1); // Exit the process with failure
  });

module.exports = mongoose;
