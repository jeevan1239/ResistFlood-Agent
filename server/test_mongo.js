import mongoose from 'mongoose';

async function testConnection() {
  const uris = [
    'mongodb://sudupa:root@127.0.0.1:27017/resistflood?authSource=admin',
    'mongodb://sudupa:root@localhost:27017/resistflood?authSource=admin',
    'mongodb://sudupa:root@127.0.0.1:27017/resistflood',
    'mongodb://127.0.0.1:27017/resistflood'
  ];

  for (const uri of uris) {
    try {
      await mongoose.connect(uri);
      console.log('SUCCESS:', uri);
      process.exit(0);
    } catch (err) {
      console.log('FAIL:', uri, err.message);
    }
  }
}

testConnection();
