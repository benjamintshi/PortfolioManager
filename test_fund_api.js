const axios = require('axios');

async function testFund(code) {
  try {
    const url = `http://fundgz.1234567.com.cn/js/${code}.js`;
    console.log(`Fetching ${url}...`);
    const response = await axios.get(url);
    const match = response.data.match(/jsonpgz\((.+)\)/);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log('Data:', data);
      console.log('dwjz (Net Value):', data.dwjz);
      console.log('gsz (Estimate):', data.gsz);
      console.log('Current Logic (dwjz || gsz):', data.dwjz || data.gsz);
      console.log('Proposed Logic (gsz || dwjz):', data.gsz || data.dwjz);
    } else {
      console.log('No match found');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFund('110011'); // E-Fund High Quality Goods Mixed
