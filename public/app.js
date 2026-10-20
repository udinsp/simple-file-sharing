(function () {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const form = document.getElementById('uploadForm');
  const csrf = form.querySelector('input[name="_csrf"]').value;
  const progressWrap = document.getElementById('progressWrap');
  const progress = document.getElementById('progress');
  const progressText = document.getElementById('progressText');

  function uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('_csrf', csrf);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    progressWrap.style.display = 'block';
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progress.value = pct;
        progressText.textContent = pct + '%';
      }
    });
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 400) {
        window.location.reload();
      } else {
        alert('Upload failed: ' + xhr.status);
      }
    };
    xhr.onerror = () => alert('Upload error');
    xhr.send(fd);
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.style.borderColor = '#4CAF50'; });
    });
    ['dragleave', 'drop'].forEach((ev) => {
      dropzone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); dropzone.style.borderColor = '#ccc'; });
    });
    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length) uploadFile(files[0]);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length) uploadFile(fileInput.files[0]);
    });
  }
  if (form) {
    form.addEventListener('submit', (e) => {
      if (fileInput && fileInput.files && fileInput.files.length) {
        e.preventDefault();
        uploadFile(fileInput.files[0]);
      }
    });
  }

  document.querySelectorAll('.share-form').forEach((f) => {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const res = await fetch(f.action, { method: 'POST', body: new FormData(f) });
      const data = await res.json();
      const box = f.parentElement.querySelector('.share-result');
      if (res.ok) {
        box.textContent = window.location.origin + data.url;
      } else {
        box.textContent = (data && data.error) || 'Share failed';
      }
    });
  });
})();
