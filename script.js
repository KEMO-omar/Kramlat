import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, push, onValue } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZr_OpkCfEFxeTrOc5fp7F_uvyVGlT5Yc",
  authDomain: "karamlat-99e6e.firebaseapp.com",
  databaseURL: "https://karamlat-99e6e-default-rtdb.firebaseio.com",
  projectId: "karamlat-99e6e",
  storageBucket: "karamlat-99e6e.firebasestorage.app",
  appId: "1:817474436731:web:6b4c38fd98048f1a3b6cde"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const galleryContainer = document.getElementById('gallery-container');
const imageUpload = document.getElementById('image-upload');
const userNameInput = document.getElementById('user-name-input');
const photoCountElem = document.getElementById('photo-count');

// حفظ واسترجاع الاسم
userNameInput.value = localStorage.getItem('kramlat_name') || "";

// جلب الصور وعرضها
onValue(ref(db, 'gallery_photos'), (snapshot) => {
    galleryContainer.innerHTML = '';
    const data = snapshot.val();
    if (data) {
        const photos = Object.values(data).reverse();
        photoCountElem.innerText = photos.length;
        photos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'photo-card';
            div.innerHTML = `
                <img src="${photo.url}" onclick="window.fullView('${photo.url}', '${photo.publisher}')">
                <div class="card-info">👤 ${photo.publisher}</div>
            `;
            galleryContainer.appendChild(div);
        });
    }
    document.getElementById('splash-screen').style.opacity = '0';
    setTimeout(()=> document.getElementById('splash-screen').style.display = 'none', 500);
});

// رفع الصورة
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const name = userNameInput.value.trim();
    
    if(!name) { alert("من فضلك اكتب اسمك الأول!"); return; }
    if(!file) return;

    localStorage.setItem('kramlat_name', name);
    showNote("جاري الرفع... انتظر ثواني ⏳");

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch('https://api.imgbb.com/1/upload?key=6071746271a396e95c47c139fa346080', {
            method: 'POST',
            body: formData
        });
        const json = await res.json();
        
        if(json.success) {
            await push(ref(db, 'gallery_photos'), {
                url: json.data.url,
                publisher: name,
                time: Date.now()
            });
            showNote("تم النشر بنجاح! ✅");
        }
    } catch (err) {
        showNote("خطأ في الرفع! جرب تاني ❌");
    }
});

window.fullView = (url, name) => {
    document.getElementById('modal-img').src = url;
    document.getElementById('modal-user-name').innerText = "ناشر الصورة: " + name;
    document.getElementById('image-modal').style.display = 'flex';
};

function showNote(m) {
    const n = document.createElement('div');
    n.className = 'notification-toast';
    n.innerText = m;
    document.getElementById('notification-container').appendChild(n);
    setTimeout(() => n.remove(), 3000);
}
