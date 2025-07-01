const sheetMenuURL = "https://script.google.com/macros/s/AKfycbyJhJzn-fnOiwFt2slOMub49bCe2a7aUEvIZm0Ql4BY0ISiHNnpVBWMncxknj2Tt7x1aw/exec";

let menuData = [];
let filteredMenu = [];
let qtyStorage = {}; // Penyimpanan qty berdasarkan nama menu

async function fetchMenu() {
  const res = await fetch(sheetMenuURL + "?action=menu");
  const data = await res.json();
  menuData = data.menu;
  filteredMenu = [...menuData];
  renderMenu();
}

function renderMenu() {
  const menuList = document.getElementById('menuList');
  menuList.innerHTML = '';

  filteredMenu.forEach((item) => {
    const menuName = item.Menu;
    const harga = parseInt(item.Harga);
    const qtyValue = qtyStorage[menuName] || 0;
    const subtotal = harga * qtyValue;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${menuName}</td>
      <td>Rp${harga}</td>
      <td>
        <input type="number" min="0" data-menu="${menuName}" data-harga="${harga}" class="qty" value="${qtyValue}">
      </td>
      <td>Rp <span class="subtotal">${subtotal}</span></td>
    `;
    menuList.appendChild(tr);
  });

  attachQtyListeners();
  calculateTotal();
}

function attachQtyListeners() {
  document.querySelectorAll('.qty').forEach(input => {
    input.addEventListener('input', () => {
      const menu = input.dataset.menu;
      const harga = parseInt(input.dataset.harga);
      const qty = parseInt(input.value) || 0;
      qtyStorage[menu] = qty;

      // Update subtotal per baris
      const subtotalEl = input.closest('tr').querySelector('.subtotal');
      subtotalEl.textContent = harga * qty;

      calculateTotal();
    });
  });
}


function calculateTotal() {
  let total = 0;
  for (let menu in qtyStorage) {
    const item = menuData.find(i => i.Menu === menu);
    if (!item) continue;
    const harga = parseInt(item.Harga);
    const qty = parseInt(qtyStorage[menu]) || 0;
    total += harga * qty;
  }
  document.getElementById('grandTotal').textContent = total;
  return total;
}

function isAdaItemDipilih() {
  for (let menu in qtyStorage) {
    if ((parseInt(qtyStorage[menu]) || 0) > 0) return true;
  }
  return false;
}

function generateStrukData() {
  let nama = document.getElementById('namaPembeli').value.trim();
  if (!nama) nama = "-";
  const wa = document.getElementById('waPembeli').value;
  const waktu = new Date().toLocaleString('id-ID');
  const items = [];

  let totalBelanja = 0;

  for (let menu in qtyStorage) {
    const qty = parseInt(qtyStorage[menu]) || 0;
    if (qty > 0) {
      const item = menuData.find(i => i.Menu === menu);
      if (!item) continue;
      const harga = parseInt(item.Harga);
      const subtotal = harga * qty;
      totalBelanja += subtotal;
      items.push({ menu, harga, qty, subtotal });
    }
  }

  return { nama, wa, waktu, items, totalBelanja };
}

function tampilkanKonfirmasi(struk) {
  const detail = struk.items.map(i => `${i.menu} x${i.qty} = Rp${i.subtotal}`).join('\n');
  return confirm(`Konfirmasi Input:\nNama: ${struk.nama}\nWA: ${struk.wa}\n${detail}\nTotal: Rp${struk.totalBelanja}`);
}

function kirimKeSheets(struk, via) {
  const nomorStruk = 'AUTO';
  const rows = struk.items.map(item => ({
    nomorStruk,
    waktu: struk.waktu,
    nama: struk.nama,
    wa: struk.wa,
    menu: item.menu,
    harga: item.harga,
    qty: item.qty,
    subtotal: item.subtotal,
    totalBelanja: struk.totalBelanja,
    via
  }));

  fetch(sheetMenuURL, {
    method: 'POST',
    body: JSON.stringify({ action: 'penjualan', data: rows }),
  });
}

function cetakStruk(struk) {
  let printWindow = window.open('', '', 'width=600,height=600');
  let html = `<html><head><title>Struk Laf Bite</title></head><body>`;
  html += `<h2>Struk Pembelian</h2>`;
  html += `<p>Nama: ${struk.nama}<br>Tanggal: ${struk.waktu}</p>`;
  html += `<table border="1" cellpadding="5" cellspacing="0"><tr><th>Menu</th><th>Qty</th><th>Subtotal</th></tr>`;
  struk.items.forEach(i => {
    html += `<tr><td>${i.menu}</td><td>${i.qty}</td><td>Rp${i.subtotal}</td></tr>`;
  });
  html += `</table><h3>Total: Rp${struk.totalBelanja}</h3>`;
  html += `</body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
}

function kirimViaWA(struk) {
  const text = `*Struk Pembelian Laf Bite*\nNama: ${struk.nama}\nTanggal: ${struk.waktu}\n\n` +
    struk.items.map(i => `- ${i.menu} x${i.qty} = Rp${i.subtotal}`).join('\n') +
    `\n\nTotal: Rp${struk.totalBelanja}`;

  const waNumber = struk.wa.replace(/\D/g, '');
  const link = `https://wa.me/62${waNumber}?text=${encodeURIComponent(text)}`;
  window.open(link, '_blank');
}

// Form submission
document.getElementById('kasirForm').addEventListener('submit', e => {
  e.preventDefault();

  if (!isAdaItemDipilih()) {
    alert("Belum ada item yang dipilih!");
    return;
  }

  const struk = generateStrukData();
  if (tampilkanKonfirmasi(struk)) {
    cetakStruk(struk);
    kirimKeSheets(struk, 'Cetak');
    resetFormInput();
  }
});

document.getElementById('kirimWA').addEventListener('click', () => {
  if (!isAdaItemDipilih()) {
    alert("Belum ada item yang dipilih!");
    return;
  }

  const wa = document.getElementById("waPembeli").value.trim();
  if (!wa) {
    alert("Harap isi nomor WhatsApp");
    return;
  }

  const struk = generateStrukData();
  if (tampilkanKonfirmasi(struk)) {
    kirimViaWA(struk);
    kirimKeSheets(struk, 'WhatsApp');
    resetFormInput();
  }
});

// Search menu (fix qty storage)
document.getElementById('searchMenu').addEventListener('input', function () {
  // Simpan semua qty input yang ada saat ini
  document.querySelectorAll('.qty').forEach(input => {
    const menu = input.dataset.menu;
    qtyStorage[menu] = parseInt(input.value) || 0;
  });

  const keyword = this.value.toLowerCase();
  filteredMenu = menuData.filter(item => item.Menu.toLowerCase().includes(keyword));
  renderMenu();
});

// Reset form
document.getElementById('resetForm').addEventListener('click', () => {
  document.getElementById('namaPembeli').value = '';
  document.getElementById('waPembeli').value = '';
  document.getElementById('searchMenu').value = '';
  document.getElementById('grandTotal').textContent = '0';

  qtyStorage = {}; // Clear all qty
  filteredMenu = [...menuData];
  renderMenu();
});

function resetFormInput() {
  document.getElementById('namaPembeli').value = '';
  document.getElementById('waPembeli').value = '';
  document.getElementById('searchMenu').value = '';
  document.getElementById('grandTotal').textContent = '0';

  qtyStorage = {}; // Kosongkan semua qty yang tersimpan
  filteredMenu = [...menuData]; // Tampilkan semua menu
  renderMenu(); // Tampilkan ulang
}

fetchMenu();
