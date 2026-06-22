const https = require('https');

function ipV6ToBinary(ip) {
  const parts = ip.split('::');
  let left = parts[0] ? parts[0].split(':') : [];
  let right = parts[1] ? parts[1].split(':') : [];
  
  const missingCount = 8 - (left.length + right.length);
  const middle = new Array(missingCount).fill('0000');
  
  const allParts = [...left, ...middle, ...right].map(part => {
    if (!part) return '0000';
    return part.padStart(4, '0');
  });
  
  return allParts.map(part => parseInt(part, 16).toString(2).padStart(16, '0')).join('');
}

function matchesPrefix(ipBin, prefixBin, length) {
  return ipBin.substring(0, length) === prefixBin.substring(0, length);
}

https.get('https://ip-ranges.amazonaws.com/ip-ranges.json', (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const targetIp = '2406:da14:1d62:b401:64e4:670d:c14e:5b57';
      const targetBin = ipV6ToBinary(targetIp);
      
      console.log('Target Binary:', targetBin);
      
      for (const prefix of json.ipv6_prefixes) {
        const [ip, lenStr] = prefix.ipv6_prefix.split('/');
        const len = parseInt(lenStr, 10);
        const prefixBin = ipV6ToBinary(ip);
        
        if (matchesPrefix(targetBin, prefixBin, len)) {
          console.log('Matched Prefix:', prefix.ipv6_prefix, 'Region:', prefix.region, 'Service:', prefix.service);
        }
      }
    } catch (err) {
      console.error(err);
    }
  });
}).on('error', err => console.error(err));
