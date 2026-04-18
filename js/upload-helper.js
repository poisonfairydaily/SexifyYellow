// js/upload-helper.js
window.uploadMedia = async function(file) {
    if (!file) return '';
    
    const formData = new FormData();
    formData.append('file', file);

    const WORKER_URL = 'https://sexify-uploader.poisonfairydaily.workers.dev/'; 

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error('R2 Upload Failed');
    const result = await response.json();
    return result.url; 
};
