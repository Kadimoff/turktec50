# TÜRKTECH 50: Demo senaryosu (6–7 dakika)

Hazırlık:
- `npm run db:seed` ile temiz demo verisini yükleyin.
- `npm run dev` ile sunucuyu başlatıp http://localhost:3000 adresini açın.
- Dil seçiciyi jüriye göre ayarlayın: TR veya AZ.

Mesaj: *"Platform karar vermez. Kayıt tutar, süreci görünür kılar ve raporlar. Kararı insanlar verir."*

## 1. Koordinatör: programın genel görünümü (1,5 dk)
1. Giriş sayfasında **Program koordinatörü** kartına tıklayın.
2. **Genel bakış:** KPI kutularını hedefleriyle birlikte gösterin (150 / 100 / 50 / 50 / 10), ardından program takvimini ve 8 haftalık kuluçkanın kaçıncı haftada olduğunu.
3. "Dikkat gerekenler" panelinde **MedRoute** (risk var) projesine geçin. Engellenmiş görevi ve yüksek riski gösterin.
4. **KPI ve raporlar:** başvuru hunisini ve ülke dağılımını (Türk dünyası boyutu) gösterin, sonra CSV dışa aktarın.

## 2. Ekip: kendi çalışma alanı (1,5 dk)
1. Çıkış yapıp **Ekip üyesi** olarak girin (AgroSense, Rəna Məmmədli).
2. Menüde yalnızca kendi projesinin göründüğünü belirtin (rol bazlı erişim).
3. **Görevler:** bir görevi "Devam ediyor"dan "İncelemede"ye taşıyın.
4. **Belge kontrol listesi:** "Test kanıtı" için yeni bir sürüm yükleyin. Hazırlık yüzdesini ve gizli belge seçeneğini gösterin.

## 3. Mentor: görüşme notu → görev (1 dk)
1. **Mentor** olarak girin (Elvin Quliyev). Yalnızca atandığı ekipler görünür.
2. **Mentorlar:** AgroSense "MVP kontrol görüşmesi" oturumunu tamamlayın, not ve 2 sonraki adım ekleyin.
3. Bir sonraki adımı **"Göreve dönüştür"** ile göreve çevirin. Görev, ekibin panosunda kaynağıyla birlikte görünür.
4. **Belgeler:** ekibin yüklediği belgeyi onaylayın ya da düzeltme isteyin.

## 4. Jüri: rubrikle değerlendirme (1 dk)
1. **Jüri** olarak girin (Prof. Səbinə Kərimova).
2. **Jüri paneli:** atanmış projeleri ve ara jüriye kalan süreyi gösterin.
3. AgroSense → **Değerlendirme:** 5 kriteri 1–5 arası puanlayın. Ağırlıklı puan yalnızca bilgilendirme amaçlıdır. Gönderin.
4. **Başvurular:** puanlanmayı bekleyen seçim başvurularını gösterin. Jürinin kabul veya ret düğmesi yoktur.

## 5. Koordinatör: karar ve iz (1 dk)
1. Koordinatöre geri dönün. CaspiGuard → **Değerlendirme:** jüri ortalamalarını ve görüş ayrılığı uyarısını gösterin.
2. AgroSense → **Genel bakış:** aşamayı "Prototip"ten "MVP"ye geçirin. Not zorunludur, ekibe bildirim gider.
3. **İşlem kaydı:** demo boyunca yapılan her adımın kim tarafından ve ne zaman yapıldığını gösterin.
4. Dil seçicide AZ → TR → EN arasında geçin, ardından koyu modu açın.

## Olası sorular
- **Veri güvenliği:** asgari veri toplanır, rol bazlı erişim sunucu tarafında uygulanır, gizli belgeler jüriden gizlenir, her işlem kaydedilir.
- **Ölçekleme:** çok üniversiteli veri modeli hazır (University, Competition). Ortak üniversiteler aynı rubrik ve takvimle katılabilir.
- **Maliyet:** tek bir Docker sunucusu (Coolify) ve PostgreSQL yeterli. Bütçedeki 1.200 AZN'lik "yazılım ve dijital hizmetler" kalemi içinde kalır.
