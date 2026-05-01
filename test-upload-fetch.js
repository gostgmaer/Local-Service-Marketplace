const fs = require('fs');

const bearerToken = process.env.TEST_UPLOAD_BEARER_TOKEN;

async function testUpload() {
  try {
    if (!bearerToken) {
      throw new Error('Set TEST_UPLOAD_BEARER_TOKEN before running this script.');
    }

    fs.writeFileSync('test.txt', 'hello world');
    
    const form = new FormData();
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    form.append('file', blob, 'test.txt');
    form.append('document_type', 'government_id');
    form.append('expiry_date', '2029-06-29');

    const response = await fetch(
      'http://localhost:3700/api/v1/provider-documents/upload/4b79f197-9988-4752-b3b8-3a44d055ea8a',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`
        },
        body: form
      }
    );
    const text = await response.text();
    console.log('Success:', response.status, text);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testUpload();
