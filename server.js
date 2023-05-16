const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  // Menentukan direktori file yang akan di-share
  const filePath = path.join(__dirname, 'files', req.url);

  if (req.url === '/') {
    // Jika URL root, tampilkan daftar file yang ada di direktori "files"
    fs.readdir(path.join(__dirname, 'files'), (err, files) => {
      if (err) {
        res.statusCode = 500;
        res.end('Internal server error!');
      } else {
        let fileTable = `
          <html>
            <head>
              <title>File Server</title>
			  <link rel="shortcut icon" href="data:image/x-icon;base64,AAABAAEAICAAAAEAIACoEAAAFgAAACgAAAAgAAAAQAAAAAEAIAAAAAAAABAAAMMOAADDDgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABQAAABnAQEBkwEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAQEBlAEBAZQBAQGUAAEBkwAAAGcAAAAUAgQEpCNHWPw/gJ7/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/0CCoP9AgqD/QIKg/z+CoP8oeZ7/DkFY/AEDBKQOHST3WLPa/2nV//9o0///aNP//2jT//9o0///aNP//2jT//9o0///aNP//2jT//9o0///aNP//2jT//9o0///aNP//2jT//9o0///aNP//2jT//9o0///aNP//2jT//9o0///aNP//2jT//9o0///adP//0/M//8lotr/Bhok9xIlLf9cvOb/Z9D//2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9nz///Ucn//yeq5v8IIi3/EiUt/1y75v9n0P//Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2fP//9Ryf//J6rm/wghLf8SJS3/XLvm/2fQ//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Z8///1HJ//8nqub/CCEt/xIlLf9cu+b/Z9D//2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9nz///Ucn//yeq5v8IIS3/EiUt/1y75v9n0P//Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2fP//9Ryf//J6rm/wghLf8SJS3/XLvm/2fQ//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Z8///1HJ//8nqub/CCEt/xIlLf9cu+b/Z9D//2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9nz///Ucn//yeq5v8IIS3/EiUt/1y75v9n0P//Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2fP//9Ryf//J6rm/wghLf8SJS3/XLvm/2fQ//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Z8///1HJ//8nqub/CCEt/xIlLf9cu+b/Z9D//2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9nz///Ucn//yeq5v8IIS3/EiUt/1y75v9n0P//Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2fP//9Ryf//J6rm/wghLf8SJS3/XLvm/2fQ//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Z8///1HJ//8nqub/CCEt/xIlLf9dvOb/Z9D//2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9nz///Ucn//yeq5v8IIS3/ChUa/1Gkyv9n0v//ZtD//2bQ//9m0P//ZtD//2bQ//9m0P//ZtD//2bQ//9m0P//ZtD//2bQ//9m0P//ZtD//2fR//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2fP//9Ryf//J6rm/wghLf8BBAb/FTA8/ylVaP8rV2v/K1dr/ytXa/8rV2v/K1dr/ytXa/8rV2v/K1dr/ytXa/8rV2v/K1dr/ytXa/8qVmr/RIyt/2bP/f9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9mz///Z8///1HJ//8nqub/CCEt/wcgK/8VZov/KC8x/5qYl/+hn57/oZ+e/6Gfnv+hn57/oZ+e/6Gfnv+hn57/oZ+e/6Gfnv+hn57/oqCf/5WTkv80Oz//PoKg/2bQ/v9mz///Zs///2bP//9mz///Zs///2bP//9mz///Zs///2bP//9nz///Ucn//yeq5v8IIS3/CCQx/xuDsf9ASk//9fT0/////////////////////////////////////////////////////////////////8nIx/80PED/P4Kh/2bQ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" />
              <style>
                table {
                  border-collapse: collapse;
                  width: 100%;
                }
                th, td {
                  text-align: left;
                  padding: 8px;
                }
                th {
                  background-color: #4CAF50;
                  color: white;
                }
                tr:nth-child(even) {background-color: #f2f2f2;}
                @media (max-width: 600px) {
                  table, thead, tbody, th, td, tr {
                    display: block;
                  }
                  th {
                    text-align: center;
                  }
                  td {
                    text-align: center;
                    border: none;
                  }
                  td:before {
                    content: attr(data-label);
                    font-weight: bold;
                    display: block;
                    text-align: left;
                    margin-bottom: 5px;
                  }
                }
              </style>
            </head>
            <body>
              <center><h1>File Server</h1></center>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Download</th>
                  </tr>
                </thead>
                <tbody>
        `;
        files.forEach((file) => {
          const fileStats = fs.statSync(path.join(__dirname, 'files', file));
          const fileSize = fileStats.size / 1000000.0; // convert to MB
          const encodedFileName = encodeURIComponent(file); // encode file name
          fileTable += `
            <tr>
              <td>${file}</td>
              <td>${fileSize.toFixed(2)} MB</td>
              <td><a href="/download?file=${encodedFileName}">Download</a></td>
            </tr>
          `;
        });
        fileTable += `
                </tbody>
              </table>
            </body>
          </html>
        `;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');
        res.end(fileTable);
      }
    });
  } else if (req.url.startsWith('/download')) {
    // Jika URL download, ambil nama file dari query parameter
    const fileName = req.url.split('=')[1];
    const decodedFileName = decodeURIComponent(fileName); // decode file name
    const fileDownloadPath = path.join(__dirname, 'files', decodedFileName);
    // Set header untuk respons download
    res.setHeader('Content-Disposition', `attachment; filename=${decodedFileName}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    // Baca file dan kirim sebagai respons
    const fileStream = fs.createReadStream(fileDownloadPath);
    fileStream.pipe(res);
  } else {
    // Jika bukan URL root atau URL download, kirimkan respons 404
    res.statusCode = 404;
    res.end('File not found!');
  }
});

// Mendengarkan pada port 80
server.listen(80, () => {
  console.log('Server is running on http://localhost:80');
});
