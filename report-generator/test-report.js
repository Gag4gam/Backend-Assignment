import { getReportData } from './reportData.js';

const report = getReportData();
console.log(JSON.stringify(report, null, 2 ));