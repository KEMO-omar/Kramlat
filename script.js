// استيراد مكتبات Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, push, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCZr_OpkCfEFxeTrOc5fp7F_uvyVGlT5Yc",
  authDomain: "karamlat-99e6e.firebaseapp.com",
  databaseURL: "https://karamlat-99e6e-default-rtdb.firebaseio.com",
  projectId: "karamlat-99e6e",
  storageBucket: "karamlat-99e6e.firebasestorage.app",
  messagingSenderId: "817474436731",
  appId: "1:817474436731:web:6b4c38fd98048f1a3b6cde"
};

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// العناصر من HTML
const galleryContainer = document.getElementById('gallery-container');
const imageUpload = document.getElementById('image-upload');
const userNameInput = document.getElementById('user-name-input');
const photoCountElem = document.getElementById('photo-count');
const splashScreen = document.getElementById('splash-screen');

// تحميل الاسم المحفوظ مسبقاً
const savedName = localStorage.getItem('kramlat_user_name');
if (savedName) {
    userNameInput.value = savedName;
}

// تسجيل الدخول مجهول الهوية
signInAnonymously(auth).catch(err => console.error("Auth Error:", err));

// دالة عرض الصور
onValue(ref(db, 'gallery_photos'), (snapshot) => {
    galleryContainer.innerHTML = '';
    let count = 0;
    const data = snapshot.val();
    
    if (data) {
        const photos = Object.entries(data).reverse(); // الأحدث أولاً
        count = photos.length;
        
        photos.forEach(([id, photo]) => {
            const card = document.createElement('div');
            card.className = 'photo-card';
            card.innerHTML = `
                <img src="${photo.url}" loading="lazy" onclick="openModal('${photo.url}', '${photo.publisher}')">
                <div class="card-info">
                    <span class="publisher">👤 ${photo.publisher || 'فاعل خير'}</span>
                </div>
            `;
            galleryContainer.appendChild(card);
        });
    }
    photoCountElem.innerText = count;
    splashScreen.style.display = 'none'; // إخفاء شاشة التحميل بعد جلب البيانات
});

// معالجة رفع الصورة
imageUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const publisherName = userNameInput.value.trim() || "مجهول";
    
    if (!file) return;

    // حفظ الاسم للمرات القادمة
    localStorage.setItem('kramlat_user_name', publisherName);

    showNotification("جاري معالجة الصورة ونشرها... ⏳");

    try {
        // تحويل الصورة لـ Base64 للمعالجة (إضافة علامة مائية بسيطة برمجياً أو رفعها مباشرة)
        const formData = new FormData();
        formData.append('image', file);

        // الرفع لخدمة ImgBB (يفضل استبدال المفتاح بمفتاحك الخاص)
        const response = await fetch('https://api.imgbb.com/1/upload?key=6071746271a396e95c47c139fa346080', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            // حفظ الرابط والاسم في Firebase
            await push(ref(db, 'gallery_photos'), {
                url: result.data.url,
                publisher: publisherName,
                timestamp: Date.now(),
                likes: 0
            });
            showNotification("تم النشر بنجاح! عيد مبارك 🎉");
        }
    } catch (error) {
        console.error(error);
        showNotification("عذراً، حدث خطأ أثناء الرفع ❌");
    }
});

// وظائف النافذة المنبثقة (Modal)
window.openModal = (url, name) => {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalName = document.getElementById('modal-user-name');
    
    modalImg.src = url;
    modalName.innerText = "ناشر الصورة: " + name;
    modal.style.display = 'flex';
};

document.getElementById('modal-close-btn').onclick = () => {
    document.getElementById('image-modal').style.display = 'none';
};

// نظام التنبيهات البسيط
function showNotification(msg) {
    const container = document.getElementById('notification-container');
    const note = document.createElement('div');
    note.className = 'notification-toast';
    note.innerText = msg;
    container.appendChild(note);
    setTimeout(() => note.remove(), 3000);
}
