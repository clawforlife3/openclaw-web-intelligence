import { getDashboardSnapshot } from '../observability/dashboard.js';

const snapshot = getDashboardSnapshot();
console.log(JSON.stringify(snapshot, null, 2));
