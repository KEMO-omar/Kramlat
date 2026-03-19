// استيراد مكتبات Firebase (الإصدار الحديث 10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, push, onValue, get, remove, runTransaction, off } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// إعدادات Firebase الخاصة بك
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
const auth = getAuth(app);
const db = getDatabase(app);

let currentUserUid = null;

// تسجيل الدخول المجهول (Anonymous Auth)
signInAnonymously(auth).catch((error) => console.error("Auth Failed:", error));
onAuthStateChanged(auth, (user) => {
    if (user) currentUserUid = user.uid;
});

// إعدادات ImgBB
// !!! تنبيه أمني: لا تضع مفاتيح API السرية في كود الواجهة الأمامية في المشاريع الحقيقية.
// أي شخص يمكنه رؤية هذا المفتاح. الطريقة الآمنة هي استخدام خادم وسيط (backend).
const IMGBB_API_KEY = "bf5f0cca2bb14e21560bea65c5e2c70b";

// جلب العناصر من صفحة HTML
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const statusDiv = document.getElementById('status');
const galleryDiv = document.getElementById('gallery');
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const modalDate = document.getElementById('modal-date'); // الحاوية الجديدة في الهيدر
const prevBtn = document.getElementById('prev-btn'); // تعريف الأزرار
const nextBtn = document.getElementById('next-btn');
const slideshowBtn = document.getElementById('slideshow-btn'); // زر العرض التلقائي
const slideshowSpeedBtn = document.getElementById('slideshow-speed-btn');
const slideshowSpeedMenu = document.getElementById('slideshow-speed-menu');
const swipeInstruction = document.getElementById('swipe-instruction'); // عنصر الإرشادات
const closeModalBtn = document.getElementById('modal-close-btn');
const downloadBtn = document.getElementById('download-btn');
const miniPreviewContainer = document.getElementById('mini-preview');
const miniGrid = document.getElementById('mini-grid');
const clearPreviewBtn = document.getElementById('clear-preview');
const totalPhotosCountEl = document.getElementById('total-photos-count'); // عنصر العداد
const sortMenuBtn = document.getElementById('sort-menu-btn');
const sortMenu = document.getElementById('sort-menu');
const notificationToast = document.getElementById('notification-toast');
const installPwaBtn = document.getElementById('install-pwa-btn');
const notificationsBtn = document.getElementById('enable-notifications-btn');
const headerSettingsBtn = document.getElementById('header-settings-btn');
const headerDropdown = document.getElementById('header-dropdown');

let shownNotifications = new Set();

// تحديث نص عدد الصور المحددة
fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files.length > 0) {
        showPreview(files);
    }
});

// دالة لعرض رسائل الحالة للمستخدم
const showStatus = (message, isError = false, clearAfter = 0) => {
    statusDiv.textContent = message;

    if (clearAfter > 0) {
        setTimeout(() => {
            statusDiv.textContent = 'اختر الصور من هنا لتشارك لحظاتك';
        }, clearAfter);
    }
};

// رسائل تهنئة عشوائية
const eidGreetings = [
    "كل عام وأنتم بخير",
    "عيدكم مبارك",
    "عساكم من عواده"
];

// دالة إضافة علامة مائية (شعار كرملات)
const addWatermark = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // تحسين السرعة: تقليل أبعاد الصورة إذا كانت كبيرة جداً (للتسريع وتقليل حجم البيانات)
                const MAX_SIZE = 1280; 
                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                
                // رسم الصورة الأصلية بالأبعاد المحسنة
                ctx.drawImage(img, 0, 0, width, height);
                
                // إعدادات النص (الشعار)
                const fontSize = Math.max(20, width / 35); // تكبير الخط قليلاً ليتناسب مع الحاوية
                ctx.font = `bold ${fontSize}px 'Tajawal', sans-serif`;
                
                // اختيار رسالة عشوائية
                const randomGreeting = eidGreetings[Math.floor(Math.random() * eidGreetings.length)];
                const watermarkText = `كرملات | ${randomGreeting}`;
                
                // حساب أبعاد النص والخلفية
                const textMetrics = ctx.measureText(watermarkText);
                const textWidth = textMetrics.width;
                const paddingX = fontSize;
                const paddingY = fontSize / 2;
                const rectWidth = textWidth + (paddingX * 2);
                const rectHeight = fontSize + (paddingY * 2);
                const x = 20; // هامش من اليسار
                const y = 20; // هامش من الأعلى

                // رسم الخلفية الحمراء (كبسولة)
                ctx.fillStyle = '#c0392b'; // لون أحمر احترافي
                // دالة لرسم مستطيل بحواف دائرية
                ctx.beginPath();
                ctx.roundRect(x, y, rectWidth, rectHeight, 15);
                ctx.fill();

                // رسم النص
                ctx.fillStyle = '#ffffff'; // لون أبيض للنص
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                // تصحيح موقع النص ليكون في منتصف المستطيل
                ctx.fillText(watermarkText, x + paddingX, y + (rectHeight / 2) + 2); // +2 للتصحيح البصري للخط
                
                // تحويل الـ canvas إلى Blob بصيغة JPEG مضغوطة لتسريع الرفع
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.8);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// المعالج الرئيسي لعملية الرفع
const handleUpload = async () => {
    const files = fileInput.files;

    if (files.length === 0) {
        // This case should not happen with the new UI, but as a fallback
        hidePreview();
        return;
    }

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = "⏳"; // رمز الانتظار
    uploadBtn.classList.remove('ready');
    showStatus("جاري رفع الصور...", false, 0); // Show status in the main bar

    const photosRootRef = ref(db, 'photos');
    try {
        let uploadedCount = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // تحقق إضافي أن الملف صورة
            if (!file.type.startsWith('image/')) {
                console.warn(`الملف ${file.name} ليس صورة.`);
                continue;
            }

            showStatus(`جاري رفع الصورة ${i + 1} من ${files.length}... (رجاءً لا تغلق الصفحة)`);
            
            // إضافة العلامة المائية
            let fileToUpload = file;
            try {
                const watermarkedBlob = await addWatermark(file);
                // استخدام اسم الملف الأصلي لكن بنوع JPEG لأننا حولناها لضغط أفضل
                fileToUpload = new File([watermarkedBlob], file.name, { type: 'image/jpeg' });
            } catch (err) {
                console.error("فشل إضافة العلامة المائية، سيتم رفع الصورة الأصلية:", err);
            }

            const formData = new FormData();
            formData.append('image', fileToUpload, file.name); // رفع الصورة المعدلة

            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });

            if (!imgbbResponse.ok) {
                console.error(`فشل رفع الصورة ${file.name}. الحالة: ${imgbbResponse.status}`);
                continue; // انتقل إلى الصورة التالية
            }

            const imgbbData = await imgbbResponse.json();

            if (imgbbData.success) {
                const imageUrl = imgbbData.data.url;
                const newPhotoRef = await push(photosRootRef, {
                    url: imgbbData.data.url, // الرابط الكامل
                    thumbUrl: imgbbData.data.thumb.url, // الرابط المصغر
                    mediumUrl: imgbbData.data.medium ? imgbbData.data.medium.url : "", // الرابط المتوسط (إن وجد)
                    likes: 0, // عدد الإعجابات المبدئي
                    ownerUid: currentUserUid, // ربط الصورة بالمستخدم الحالي لتمكينه من الحذف لاحقاً
                    timestamp: Date.now()
                });
                uploadedCount++;
            } else {
                console.error(`فشل رفع الصورة ${file.name} إلى ImgBB:`, imgbbData);
            }
        }

        showStatus(`✅ تم رفع ${uploadedCount} صورة بنجاح!`, false, 5000);
        hidePreview();
        
    } catch (error) {
        console.error("حدث خطأ في عملية الرفع:", error);
        // Show error in the preview screen before closing it
        const uploadBtnRef = document.getElementById('upload-btn');
        uploadBtnRef.innerHTML = '❌';
        setTimeout(() => {
            showStatus("❌ حدث خطأ أثناء الرفع. حاول مرة أخرى.", true, 8000);
            hidePreview();
        }, 2000);
    }
};

uploadBtn.addEventListener('click', handleUpload);

// دالة لإنشاء لون نيون عشوائي
const getRandomNeonColor = () => {
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 100%, 65%)`;
};

// دالة حساب الوقت النسبي
const getRelativeTime = (timestamp) => {
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "الآن";
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffDays} يوم`;
};

// تحديث الوقت النسبي تلقائياً كل دقيقة
setInterval(() => {
    document.querySelectorAll('.photo-card').forEach(card => {
        const timestamp = parseInt(card.dataset.timestamp);
        if (timestamp) {
            const relativeSpan = card.querySelector('.date-relative');
            if (relativeSpan) relativeSpan.textContent = getRelativeTime(timestamp);
        }
    });
}, 60000);

// متغيرات للتمرير اللانهائي
let allPhotosData = [];
let renderedCount = 0;
let currentSort = 'newest'; // 'newest' or 'popular'
const BATCH_SIZE = 12; // عدد الصور في كل دفعة
let lastMaxTimestamp = 0; // لتتبع آخر صورة تم تحميلها ومعرفة الجديد
let isInitialLoad = true; // لتجنب الإشعارات عند فتح الصفحة لأول مرة

// جلب الصور من Firebase وعرضها في المعرض بشكل لحظي (Realtime) مع ترتيبها حسب الأحدث
const photosRef = ref(db, 'photos');
onValue(photosRef, (snapshot) => {
    if (!snapshot.exists()) {
        galleryDiv.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #777;">لا توجد صور حتى الآن. كن أول من يشارك لحظاته!</p>';
        return;
    }

    const allUsersData = snapshot.val();
    allPhotosData = [];
    let currentBatchMaxTimestamp = 0;
    let newPhotoDetected = null;

    // 1. تجميع كل الصور في مصفوفة واحدة مع معلومات المستخدم
    for (const photoId in allUsersData) {
        const photo = { id: photoId, ...allUsersData[photoId] };
        allPhotosData.push(photo);

        // تتبع أحدث صورة للكشف عن التحديثات
        if (photo.timestamp > currentBatchMaxTimestamp) {
            currentBatchMaxTimestamp = photo.timestamp;
            // إذا كان هذا الطابع الزمني أحدث من آخر شيء نعرفه، وهذه ليست المرة الأولى، فهي صورة جديدة
            if (!isInitialLoad && photo.timestamp > lastMaxTimestamp) {
                newPhotoDetected = photo;
            }
        }
    }

    // تحديث أحدث طابع زمني معروف
    if (currentBatchMaxTimestamp > lastMaxTimestamp) {
        lastMaxTimestamp = currentBatchMaxTimestamp;
    }

    // تحديث العداد في الهيدر
    if (totalPhotosCountEl) totalPhotosCountEl.textContent = allPhotosData.length;

    // 2. ترتيب المصفوفة بناءً على نوع الفرز الحالي
    if (currentSort === 'newest') {
        allPhotosData.sort((a, b) => b.timestamp - a.timestamp);
    } else { // popular
        allPhotosData.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }

    // عند وصول بيانات جديدة، نعيد رسم المعرض بناءً على العدد الحالي المعروض (للحفاظ على مكان التمرير)
    // إذا كان أول تحميل، نعرض الدفعة الأولى فقط
    if (renderedCount === 0) renderedCount = BATCH_SIZE;
    renderGallery();

    // إطلاق إشعار إذا تم اكتشاف صورة جديدة
    if (newPhotoDetected && newPhotoDetected.ownerUid !== currentUserUid) {
        sendSystemNotification("صورة جديدة! 📸", "قام أحد الأصدقاء بإضافة صورة جديدة للتو");
    }

    // بعد أول تحميل، نغير الحالة لنسمح بالإشعارات اللاحقة
    if (isInitialLoad) {
        isInitialLoad = false;
    }
});

// دالة المزامنة لعرض المعرض بدون وميض (تحديث العناصر الموجودة وإنشاء الجديدة)
const renderGallery = () => {
    // التحسين: استخدام Map لتقليل عمليات البحث في DOM بشكل كبير
    const photosToRender = allPhotosData.slice(0, renderedCount);
    const photosToRenderIds = new Set(photosToRender.map(p => p.id));
    
    // جلب الكروت الموجودة حالياً في الـ DOM
    const existingCards = new Map();
    Array.from(galleryDiv.children).forEach(card => {
        if (card.dataset.id) {
            existingCards.set(card.dataset.id, card);
        }
    });

    // 1. حذف البطاقات التي لم تعد موجودة
    existingCards.forEach((card, id) => {
        if (!photosToRenderIds.has(id)) {
            card.remove();
        }
    });

    // 2. تحديث أو إنشاء البطاقات بالترتيب الصحيح
    photosToRender.forEach((photoData, index) => {
        let card = existingCards.get(photoData.id);
        
        if (card) {
            // تحديث البيانات إذا كانت موجودة
            updateCardData(card, photoData, true);
            // التأكد من الترتيب الصحيح في القائمة
            if (galleryDiv.children[index] !== card) {
                galleryDiv.insertBefore(card, galleryDiv.children[index]);
            }
        } else {
            // إنشاء بطاقة جديدة إذا لم تكن موجودة
            card = createCard(photoData);
            galleryDiv.insertBefore(card, galleryDiv.children[index] || null);
        }
    });
};

// إنشاء بطاقة جديدة
const createCard = (photoData) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.dataset.id = photoData.id; // تعيين معرف للصورة للرجوع إليه
    card.dataset.timestamp = photoData.timestamp;

    card.style.setProperty('--neon-color', getRandomNeonColor());

    const img = document.createElement('img');
    img.src = photoData.mediumUrl || photoData.url; 
    img.alt = `صورة تمت مشاركتها`;
    img.loading = "lazy";
    card.appendChild(img);
    
    // حاوية زر الإعجاب
    const likeContainer = document.createElement('div');
    likeContainer.className = 'like-container';
    card.appendChild(likeContainer); // سيتم ملؤها في updateCardData

    // زر الحذف
    // التحقق من الملكية باستخدام UID القادم من Firebase Auth
    if (currentUserUid && photoData.ownerUid === currentUserUid) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'حذف الصورة';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('هل أنت متأكد أنك تريد حذف هذه الصورة؟')) {
                remove(ref(db, `photos/${photoData.id}`));
            }
        };
        card.appendChild(deleteBtn);
    }

    // --- إضافة التاريخ الاحترافي ---
    if (photoData.timestamp) {
        const dateDiv = document.createElement('div');
        dateDiv.className = 'card-date';
        
        const dateObj = new Date(photoData.timestamp);
        const relativeTime = getRelativeTime(photoData.timestamp);

        const timeStr = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric' }).format(dateObj);
        const dateStr = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);

        dateDiv.innerHTML = `
            <span class="date-relative">${relativeTime}</span>
            <span class="date-details">${timeStr} | ${dateStr}</span>
        `;
        
        card.appendChild(dateDiv);
    }

    // تحديث البيانات الأولية (بما في ذلك زر اللايك ورابط النقر)
    updateCardData(card, photoData, true);

    return card;
};

// تحديث بيانات البطاقة (خاصة اللايكات) دون إعادة بناء العنصر
const updateCardData = (card, photoData, updateClickEvent = false) => {
    // تحديث الصورة نفسها إذا لزم الأمر (في حال تغيرت البيانات)
    const img = card.querySelector('img');
    if (img && img.src !== (photoData.mediumUrl || photoData.url)) {
         img.src = photoData.mediumUrl || photoData.url;
    }

    // تحديث حدث النقر (مهم جداً عند إعادة استخدام العناصر أو إعادة الترتيب)
    if (updateClickEvent) {
        // إزالة المستمعين القدامى عن طريق استنساخ العنصر (أو تحديث خاصية مخصصة)
        // الطريقة الأفضل والأسرع هنا هي تخزين البيانات في العنصر واستخدامها،
        // أو ببساطة تحديث الدالة عند النقر.
        // لتبسيط الأمر، سنعيد تعيين وظيفة onclick مباشرة (تستبدل المستمعين السابقين من نوع onclick)
        card.onclick = () => openImageModal(photoData);
    }

    const likeContainer = card.querySelector('.like-container');
    // التحقق مما إذا كان المستخدم الحالي قد قام بعمل لايك سابقاً من خلال القائمة المحفوظة في الداتابيز
    const isLiked = photoData.likesUsers && photoData.likesUsers[currentUserUid];
    const likesCount = photoData.likes || 0;

    // نتحقق مما إذا كان الزر موجوداً بالفعل لتجنب استبداله إذا لم يتغير شيء جوهري، 
    // ولكن هنا سنقوم بتحديث المحتوى الداخلي للزر لضمان صحة الرقم واللون
    
    // إذا لم يكن الزر موجوداً (في حالة الإنشاء) أو نحتاج لتحديثه
    let likeBtn = likeContainer.querySelector('.like-btn');
    
    if (!likeBtn) {
        likeContainer.innerHTML = `
            <button class="like-btn">
                <div class="heart-icon-wrapper">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </div>
                <span class="like-count"></span>
            </button>
        `;
        likeBtn = likeContainer.querySelector('.like-btn');
        
        // إضافة المستمع مرة واحدة فقط عند الإنشاء
        likeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentIsLiked = likeBtn.classList.contains('liked'); // نتحقق من الحالة الحالية من الواجهة لسرعة الاستجابة
            
            // تأثير بصري فوري قبل رد الخادم
            if (!currentIsLiked) {
                likeBtn.classList.add('liked');
                const countSpan = likeBtn.querySelector('.like-count');
                const currentNum = parseInt(countSpan.textContent || '0');
                countSpan.textContent = currentNum + 1;
            } else {
                likeBtn.classList.remove('liked');
                const countSpan = likeBtn.querySelector('.like-count');
                const currentNum = parseInt(countSpan.textContent || '0');
                countSpan.textContent = currentNum > 0 ? currentNum - 1 : '';
            }

            // تحديث قاعدة البيانات والتخزين المحلي
            const photoRef = ref(db, `photos/${photoData.id}`);
            runTransaction(photoRef, (photo) => {
                if (photo) {
                    if (!photo.likesUsers) photo.likesUsers = {};
                    if (photo.likesUsers[currentUserUid]) {
                        // المستخدم عمل لايك سابقاً -> إزالة اللايك
                        photo.likes = (photo.likes || 1) - 1;
                        delete photo.likesUsers[currentUserUid];
                    } else {
                        // لايك جديد
                        photo.likes = (photo.likes || 0) + 1;
                        photo.likesUsers[currentUserUid] = true;
                    }
                    if (photo.likes < 0) photo.likes = 0;
                }
                return photo;
            });
        });
    }

    // تحديث الحالة والعدد
    const countSpan = likeBtn.querySelector('.like-count');
    const svg = likeBtn.querySelector('svg');
    
    if (isLiked) {
        likeBtn.classList.add('liked');
        svg.setAttribute('fill', 'currentColor');
    } else {
        likeBtn.classList.remove('liked');
        svg.setAttribute('fill', 'none');
    }
    
    countSpan.textContent = likesCount > 0 ? likesCount : '';
};

// متغيرات للتنقل بين الصور
let currentPhotoIndex = 0;
let touchStartX = 0;
let touchEndX = 0;
let slideshowInterval = null; // متغير لتخزين مؤقت العرض التلقائي
let slideshowSpeed = 3000; // سرعة العرض الافتراضية (3 ثواني)

// دالة لتحديث محتوى المودال (لإعادة استخدامها في التنقل)
const updateModalContent = (photoData) => {
    modalImage.classList.remove('zoomed');
    modalImage.style.transition = 'filter 0.3s ease, transform 0.3s ease';
    modalImage.style.filter = 'blur(10px)';
    const placeholder = photoData.mediumUrl || photoData.thumbUrl || photoData.url;
    modalImage.src = placeholder;
    downloadBtn.href = photoData.url;
    
    if (photoData.timestamp && modalDate) {
        const dateObj = new Date(photoData.timestamp);
        const timeStr = new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: 'numeric' }).format(dateObj);
        const dateStr = new Intl.DateTimeFormat('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }).format(dateObj);
        const relativeTime = getRelativeTime(photoData.timestamp);
        modalDate.innerHTML = `<span class="date-relative">${relativeTime}</span><span class="date-details">${timeStr} | ${dateStr}</span>`;
    } else if (modalDate) {
         modalDate.innerHTML = '';
    }

    // تحديث حالة أزرار التنقل (تفعيل/تعطيل حسب الموقع)
    if (prevBtn && nextBtn) {
        // جعلنا التنقل دائرياً، لذا الأزرار متاحة دائماً ما دام هناك أكثر من صورة
        const hasMultiple = allPhotosData.length > 1;
        prevBtn.style.opacity = hasMultiple ? '1' : '0.3';
        prevBtn.style.pointerEvents = hasMultiple ? 'auto' : 'none';
        
        nextBtn.style.opacity = hasMultiple ? '1' : '0.3';
        nextBtn.style.pointerEvents = hasMultiple ? 'auto' : 'none';
    }

    const highResImg = new Image();
    highResImg.src = photoData.url;
    highResImg.onload = () => {
        if (imageModal.classList.contains('active') && downloadBtn.href === photoData.url) {
            modalImage.src = photoData.url;
            modalImage.style.filter = 'blur(0px)';
        }
    };
};

// دالة منفصلة لفتح المودال
const openImageModal = (photoData) => {
    document.body.classList.add('no-scroll');
    currentPhotoIndex = allPhotosData.findIndex(p => p.id === photoData.id);
    if (currentPhotoIndex === -1) currentPhotoIndex = 0;
    updateModalContent(photoData);
    imageModal.classList.add('active');
    
    // إظهار إرشادات التمرير لمدة قصيرة عند الفتح
    if (swipeInstruction) {
        swipeInstruction.style.animation = 'none';
        swipeInstruction.offsetHeight; /* trigger reflow */
        swipeInstruction.style.animation = 'hintFade 4s forwards';
    }
    
    // التأكد من أن العرض التلقائي متوقف عند الفتح اليدوي
    stopSlideshow();
};

// منطق التنقل الدائري (Circular Navigation)
const navigateGallery = (direction) => {
    if (allPhotosData.length <= 1) return;

    if (direction === 'next') {
        // إذا وصلنا للنهاية، نعود للبداية (Modulo Operator)
        currentPhotoIndex = (currentPhotoIndex + 1) % allPhotosData.length;
        updateModalContent(allPhotosData[currentPhotoIndex]);
    } else if (direction === 'prev') {
        // إذا كنا في البداية، نذهب للنهاية
        currentPhotoIndex = (currentPhotoIndex - 1 + allPhotosData.length) % allPhotosData.length;
        updateModalContent(allPhotosData[currentPhotoIndex]);
    }
};

// تفعيل أزرار التنقل عند النقر
if (prevBtn) prevBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // منع إغلاق النافذة
    navigateGallery('prev');
});

if (nextBtn) nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigateGallery('next');
});

// أحداث اللمس للسحب
imageModal.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
imageModal.addEventListener('touchend', (e) => { 
    touchEndX = e.changedTouches[0].screenX;
    if (modalImage.classList.contains('zoomed')) return;
    if (touchEndX < touchStartX - 50) navigateGallery('next');
    if (touchEndX > touchStartX + 50) navigateGallery('prev');
}, {passive: true});

// أحداث لوحة المفاتيح
document.addEventListener('keydown', (e) => {
    if (!imageModal.classList.contains('active')) return;
    if (e.key === 'ArrowLeft') navigateGallery('next');
    if (e.key === 'ArrowRight') navigateGallery('prev');
    if (e.key === 'Escape') closeModal();
});

// --- منطق العرض التلقائي (Slideshow) ---
const startSlideshow = () => {
    if (slideshowInterval) return;
    
    // تغيير أيقونة الزر إلى "إيقاف مؤقت"
    slideshowBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    slideshowBtn.classList.add('playing');
    
    // تحريك الصورة كل 3 ثواني
    slideshowInterval = setInterval(() => {
        navigateGallery('next');
    }, slideshowSpeed); // استخدام متغير السرعة
};

const stopSlideshow = () => {
    if (!slideshowInterval) return;
    
    clearInterval(slideshowInterval);
    slideshowInterval = null;
    
    // إعادة الأيقونة إلى "تشغيل"
    slideshowBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    slideshowBtn.classList.remove('playing');
};

if (slideshowBtn) {
    slideshowBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (slideshowInterval) stopSlideshow();
        else startSlideshow();
    });
}

// --- منطق التحكم في سرعة العرض ---
if (slideshowSpeedBtn) {
    slideshowSpeedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        slideshowSpeedMenu.classList.toggle('active');
    });

    document.querySelectorAll('.speed-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            slideshowSpeed = parseInt(btn.dataset.speed, 10);
            
            // تحديث الحالة المرئية للزر النشط
            document.querySelector('.speed-option.active').classList.remove('active');
            btn.classList.add('active');
            slideshowSpeedMenu.classList.remove('active');

            // إذا كان العرض يعمل، أعد تشغيله بالسرعة الجديدة
            if (slideshowInterval) {
                stopSlideshow();
                startSlideshow();
            }
        });
    });
}

// حدث التمرير للتحميل اللانهائي
window.addEventListener('scroll', () => {
    // إذا وصلنا لنهاية الصفحة (ناقص 200 بكسل)
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
        if (renderedCount < allPhotosData.length) {
            renderedCount += BATCH_SIZE;
            renderGallery();
        }
    }
});

// --- أحداث أزرار الفرز ---
// دالة موحدة للفرز مع تأثير حركة
const handleSort = (type) => {
    if (currentSort === type) return;
    currentSort = type;

    // تحديث حالة الخيارات في القائمة
    document.querySelectorAll('.sort-option').forEach(btn => {
        if (btn.dataset.sort === type) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // إغلاق القائمة بعد الاختيار
    sortMenu.classList.remove('active');

    // 1. بدء تأثير الاختفاء
    galleryDiv.style.opacity = '0';
    galleryDiv.style.transform = 'translateY(10px)';

    // 2. الانتظار قليلاً ثم الفرز وإعادة العرض
    setTimeout(() => {
        if (currentSort === 'newest') {
            allPhotosData.sort((a, b) => b.timestamp - a.timestamp);
        } else {
            allPhotosData.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        }

        galleryDiv.innerHTML = ''; // مسح المحتوى الحالي
        renderedCount = BATCH_SIZE; // إعادة تعيين عدد الصور المعروضة
        renderGallery(); // عرض الصور بالترتيب الجديد

        // 3. إنهاء تأثير الظهور
        galleryDiv.style.opacity = '1';
        galleryDiv.style.transform = 'translateY(0)';
    }, 300); // زمن الانتقال 300ms
};

// فتح/إغلاق قائمة الفرز
sortMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle('active');
});

// إغلاق القائمة عند النقر خارجها
document.addEventListener('click', (e) => {
    if (!sortMenu.contains(e.target) && e.target !== sortMenuBtn) {
        sortMenu.classList.remove('active');
    }
    // إغلاق قائمة السرعة عند النقر خارجها
    if (slideshowSpeedMenu && !slideshowSpeedMenu.contains(e.target) && e.target !== slideshowSpeedBtn) {
        slideshowSpeedMenu.classList.remove('active');
    }
});

// --- التحكم في قائمة الهيدر المنسدلة ---
if (headerSettingsBtn && headerDropdown) {
    headerSettingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerDropdown.classList.toggle('active');
    });

    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (!headerDropdown.contains(e.target) && e.target !== headerSettingsBtn) {
            headerDropdown.classList.remove('active');
        }
    });
}

// تفعيل أزرار القائمة
document.querySelectorAll('.sort-option').forEach(btn => {
    btn.addEventListener('click', () => handleSort(btn.dataset.sort));
});

// --- Preview UI Logic ---

const showPreview = (files) => {
    miniGrid.innerHTML = ''; // Clear previous previews
    
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const thumbImg = document.createElement('img');
            thumbImg.src = e.target.result;
            miniGrid.appendChild(thumbImg);
        };
        reader.readAsDataURL(file);
    });

    // تحديث واجهة الشريط السفلي
    statusDiv.textContent = `${files.length} صور جاهزة للإرسال`;
    
    // إعادة أيقونة الإرسال وتفعيل الزر
    uploadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`;
    uploadBtn.disabled = false;
    uploadBtn.classList.add('ready');

    miniPreviewContainer.classList.add('active');
};

const hidePreview = () => {
    miniPreviewContainer.classList.remove('active');
    uploadBtn.classList.remove('ready');
    uploadBtn.disabled = true;
    statusDiv.textContent = 'اختر الصور من هنا لتشارك لحظاتك';
    fileInput.value = ''; // Clear the file input to allow re-selection
};

clearPreviewBtn.addEventListener('click', hidePreview);

// إغلاق الـ Modal
const closeModal = () => {
    stopSlideshow(); // إيقاف العرض التلقائي عند الإغلاق
    imageModal.classList.remove('active');
    // إعادة تفعيل التمرير في الصفحة
    document.body.classList.remove('no-scroll');
};

// ميزة التكبير عند النقر المزدوج
modalImage.addEventListener('dblclick', () => {
    modalImage.classList.toggle('zoomed');
});

// --- منطق التعليقات ---
let currentCommentsRef = null;

const loadComments = (photoId) => {
    commentsList.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">جاري التحميل...</div>';
    
    if (currentCommentsRef) off(currentCommentsRef); // إيقاف المستمع القديم
    
    currentCommentsRef = ref(db, `photos/${photoId}/comments`);
    onValue(currentCommentsRef, (snapshot) => {
        commentsList.innerHTML = '';
        if (snapshot.exists()) {
            const comments = snapshot.val();
            Object.values(comments).forEach(comment => {
                const div = document.createElement('div');
                
                // تحديد نوع التعليق (مرسل أم مستقبل)
                const isMyComment = comment.uid === currentUserUid;
                div.className = `comment-item ${isMyComment ? 'my-comment' : 'other-comment'}`;
                
                const time = getRelativeTime(comment.timestamp);
                div.innerHTML = `
                    <span class="comment-meta">${time}</span>
                    ${comment.text}
                `;
                commentsList.appendChild(div);
            });
            // التمرير لأسفل لرؤية آخر تعليق
            commentsList.scrollTop = commentsList.scrollHeight;
        } else {
            commentsList.innerHTML = '<div style="text-align:center; color:#999; padding:10px;">كن أول من يعلق! 💬</div>';
        }
    });
};

const setupCommentInput = (photoId) => {
    // إزالة المستمعين القدامى عن طريق استنساخ الزر
    let newBtn = sendCommentBtn.cloneNode(true);
    sendCommentBtn.parentNode.replaceChild(newBtn, sendCommentBtn); // استبدال الزر القديم بالجديد في الصفحة
    sendCommentBtn = newBtn; // **الإصلاح**: تحديث المتغير ليشير إلى الزر الجديد
    
    // دالة الإرسال الموحدة
    const handleSendComment = () => {
        const text = commentInput.value.trim();
        if (!text) return;
        
        push(ref(db, `photos/${photoId}/comments`), {
            text: text,
            timestamp: Date.now(),
            uid: currentUserUid
        });
        commentInput.value = '';
    };

    // الإرسال عند الضغط على الزر
    sendCommentBtn.addEventListener('click', handleSendComment);

    // الإرسال عند الضغط على Enter في حقل النص
    commentInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            handleSendComment();
        }
    };
};

let notificationTimeout;

const showNotification = (message) => {
    if (!notificationToast) return;
    
    notificationToast.textContent = message;
    notificationToast.classList.add('show');

    // مسح المؤقت القديم إذا كان موجوداً
    if (notificationTimeout) clearTimeout(notificationTimeout);

    // إخفاء الإشعار بعد 5 ثوانٍ
    notificationTimeout = setTimeout(() => {
        notificationToast.classList.remove('show');
    }, 5000);
};

closeModalBtn.addEventListener('click', closeModal);
imageModal.addEventListener('click', (e) => {
    // إغلاق النافذة فقط عند الضغط على الخلفية السوداء نفسها وليس على الصورة
    if (e.target.classList.contains('modal-viewer')) {
        closeModal();
    }
    // إعادة ضبط التكبير عند إغلاق النافذة (اختياري ولكنه مفضل)
    if (e.target === imageModal && modalImage.classList.contains('zoomed')) {
        modalImage.classList.remove('zoomed');
    }
});

// === دالة المشرف لتنظيف الموقع بالكامل ===
// اضغط F12 في المتصفح، ثم اذهب إلى Console واكتب: window.deleteAllPhotos()
window.deleteAllPhotos = () => {
    if(confirm("تحذير: هل أنت متأكد أنك تريد حذف جميع الصور من الموقع تماماً؟")) {
        remove(ref(db, 'photos')).then(() => alert("تم تنظيف المعرض بالكامل!"));
    }
};
// --- منطق تثبيت التطبيق (PWA) ---
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // منع ظهور شريط التثبيت التلقائي الافتراضي للمتصفح
    e.preventDefault();
    deferredPrompt = e;
    // إظهار زر التثبيت الخاص بنا في الهيدر
    if (installPwaBtn) installPwaBtn.style.display = 'flex';
});

if (installPwaBtn) {
    installPwaBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        installPwaBtn.style.display = 'none';
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
    });
}

// تسجيل Service Worker (ضروري لظهور زر التثبيت والعمل بدون نت)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.error('Service Worker registration failed', err));
    });
}

// إخفاء شاشة البداية عند اكتمال تحميل الصفحة
window.addEventListener('load', () => {
    const splash = document.getElementById('splash-screen');
    // تأخير بسيط (2 ثانية) لضمان رؤية الشاشة ولتحميل البيانات في الخلفية
    setTimeout(() => {
        if(splash) splash.classList.add('hidden');
    }, 2000); 
});

// --- منطق الإشعارات (Push Notifications) ---

// التحقق من حالة الإذن عند التحميل لتلوين الزر
if ("Notification" in window) {
    if (Notification.permission === "granted") {
        notificationsBtn.classList.add("active");
    }
}

notificationsBtn.addEventListener('click', () => {
    if (!("Notification" in window)) {
        alert("هذا المتصفح لا يدعم الإشعارات.");
        return;
    }

    if (Notification.permission === "granted") {
        alert("الإشعارات مفعلة بالفعل ✅");
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                notificationsBtn.classList.add("active");
                // إشعار تجريبي
                new Notification("تم تفعيل الإشعارات بنجاح! 🎉", {
                    body: "سنقوم بتنبيهك عند إضافة صور جديدة.",
                    icon: "https://cdn-icons-png.flaticon.com/512/3342/3342137.png" // أيقونة التطبيق
                });
            }
        });
    } else {
        alert("لقد قمت بحظر الإشعارات سابقاً. يرجى تفعيلها من إعدادات المتصفح.");
    }
});

// دالة إرسال الإشعار الفعلي
const sendSystemNotification = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
        // إخفاء الإشعار إذا كانت الصفحة مفتوحة ونشطة (اختياري، هنا نرسله دائماً)
        if (document.visibilityState === "visible") return; 

        new Notification(title, {
            body: body,
            icon: "https://cdn-icons-png.flaticon.com/512/3342/3342137.png"
        });
    }
};
