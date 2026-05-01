const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const bearerToken = process.env.TEST_UPLOAD_BEARER_TOKEN;

async function testUpload() {
  try {
    if (!bearerToken) {
      throw new Error('Set TEST_UPLOAD_BEARER_TOKEN before running this script.');
    }

    fs.writeFileSync('test.txt', 'hello world');

    const form = new FormData();
    form.append('file', fs.createReadStream('test.txt'));
    form.append('document_type', 'government_id');
    form.append('expiry_date', '2029-06-29');

    const response = await axios.post(
      'http://localhost:3700/api/v1/provider-documents/upload/4b79f197-9988-4752-b3b8-3a44d055ea8a',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${bearerToken}`
        }
      }
    );
    console.log('Success:', response.status, response.data);
  } catch (error) {
    if (error.response) {
      console.error('Error:', error.response.status, error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testUpload();
