import { config as dotenv } from 'dotenv';
import { resolve } from 'path';

dotenv({ path: resolve(__dirname, '../../.env') });
