const webpush = require('web-push');

console.log('Generating VAPID keys...\n');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('VAPID Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nVAPID Private Key:');
console.log(vapidKeys.privateKey);
console.log('\nAdd these to your .env file:');
console.log(`VAPID_PUBLIC_KEY="${vapidKeys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${vapidKeys.privateKey}"`);
console.log(`VAPID_SUBJECT="mailto:your-email@example.com"`);

