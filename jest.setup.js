import { TextEncoder, TextDecoder } from 'util';
import dotenv from 'dotenv';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Simple stubs instead of jest.fn()
global.alert = () => {};
global.confirm = () => true;

dotenv.config({ path: '.env.test', override: !process.env.MONGODB_URI });
