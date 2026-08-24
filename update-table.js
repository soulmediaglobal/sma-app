const fs = require('fs');
let html = fs.readFileSync('production/user_management.html', 'utf8');

const newTable = `<table id="users-table" class="table align-middle table-hover mb-0">
  <thead class="table-light">
    <tr>
      <th>USER</th>
      <th>ROLE</th>
      <th>JOINED</th>
      <th>LAST LOGIN</th>
      <th>LAST UPDATE</th>
      <th>PROJECTS INVOLVED</th>
      <th style="width: 50px;">ACTION</th>
    </tr>
  </thead>
  <tbody>
    <!-- Dynamic rows from user-management.js -->
  </tbody>
</table>`;

html = html.replace(/<table[\s\S]*?<\/table>/, newTable);
fs.writeFileSync('production/user_management.html', html);
console.log('HTML Table updated successfully!');
