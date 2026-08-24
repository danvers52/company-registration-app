const {TextEncoder, TextDecoder} = require('util');

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

global.alert=jest.fn();
global.confirm=jest.fn(() => true);