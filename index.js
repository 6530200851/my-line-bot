const express = require('express'); // ห้ามลืมบรรทัดนี้!
const line = require('@line/bot-sdk');
require('dotenv').config();

const app = express(); // นี่คือตัวที่ Error บอกว่าหายไปครับ

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'ใส่_Token_ใน_ไฟล์_env_นะ',
  channelSecret: process.env.CHANNEL_SECRET || 'ใส่_Secret_ใน_ไฟล์_env_นะ',
};

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// ตั้งค่าการยืนยันตัวตนกับ Google
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // แก้ไขเรื่องการขึ้นบรรทัดใหม่
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const client = new line.Client(config);

app.post('/callback', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'บอทร้านน้ำออนไลน์แล้วจ้า! ลองส่ง "เมนู" มาดูสิ',
  });
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`=================================`);
  console.log(`🚀 บอทออนไลน์แล้วที่พอร์ต ${port}`);
  console.log(`=================================`);
});

// async function handleEvent(event) {
//   // --- ส่วนโหลดข้อมูลจาก Google Sheets ---
//   const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
//   await doc.loadInfo();
//   const sheet = doc.sheetsByIndex[0]; // เลือก Sheet หน้าแรก
//   const rows = await sheet.getRows(); // ดึงข้อมูลทุกแถว
  
//   // 1. จัดการการกดที่รูปภาพ (Postback)
//   if (event.type === 'postback') {
//     const data = event.postback.data; 
//     return client.replyMessage(event.replyToken, { 
//       type: 'text', 
//       text: `บันทึกข้อมูล: ${data} เรียบร้อยครับ` 
//     });
//   }

//   // 2. จัดการข้อความพิมพ์
//   if (event.type !== 'message' || event.message.type !== 'text') return null;
//   const userText = event.message.text;

//   if (userText === 'สั่งน้ำดื่ม') {
//     // สร้างรายการคอลัมน์จากข้อมูลใน Sheet (คอลัมน์ desc ในรูป image_53be67.png)
//     const columns = rows.map(row => ({
//       imageUrl: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png', // รูปเริ่มต้น
//       action: { 
//         type: 'postback', 
//         label: `เลือก ${row.get('desc')}`, 
//         data: `item=${row.get('desc')}` 
//       }
//     })).slice(0, 10); // LINE จำกัดสูงสุด 10 รูป

    



//     return client.replyMessage(event.replyToken, {
//       type: 'template',
//       altText: 'กรุณาเลือกรายการน้ำดื่ม',
//       template: {
//         type: 'image_carousel',
//         columns: columns
//       }
//     });
//   }
// }


async function handleEvent(event) {
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();

  // --- 1. ส่วนจัดการ Postback (การกดปุ่มเลือก) ---
  if (event.type === 'postback') {
    const data = event.postback.data;
    const params = new URLSearchParams(data);
    const action = params.get('action');
    const brand = params.get('brand');
    const size = params.get('size');

    // เลือกยี่ห้อเสร็จ -> ส่งรายการขนาดให้เลือกต่อ
    if (action === 'select_size') {
      const sizeSheet = doc.sheetsByTitle['size'];
      const sizeRows = await sizeSheet.getRows();
      const sizeColumns = sizeRows.map(row => ({
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png',
        action: {
          type: 'postback',
          label: `ขนาด ${row.get('desc')}`, 
          data: `action=confirm_option&brand=${brand}&size=${row.get('desc')}`
        }
      })).filter(col => col.action.label !== 'ขนาด undefined').slice(0, 10);

      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: 'กรุณาเลือกขนาด',
        template: { type: 'image_carousel', columns: sizeColumns }
      });
    }

    // เลือกขนาดเสร็จ -> บันทึกจองลงตะกร้า cart และถามจำนวน
    if (action === 'confirm_option') {
      const cartSheet = doc.sheetsByTitle['cart'];
      await cartSheet.addRow({ 
        userId: event.source.userId, 
        brand: brand, 
        size: size 
      }); 

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `คุณเลือก ${brand} ขนาด ${size}\n\n👉 กรุณาพิมพ์ "จำนวน" ที่ต้องการสั่งเป็นตัวเลขครับ (เช่น 3)`
      });
    }
  }

  // --- 2. ส่วนจัดการข้อความ (Text Message) ---
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userText = event.message.text;

  // ก. ตรวจสอบถ้าลูกค้าพิมพ์ "จำนวน" (ตัวเลข)
  const matchNumber = userText.match(/\d+/); 
  if (matchNumber) {
    const qty = matchNumber[0];
    const cartSheet = doc.sheetsByTitle['cart'];
    const rows = await cartSheet.getRows();
    // หาแถวล่าสุดที่ยังไม่มีจำนวน
    const userCart = rows.reverse().find(row => row.get('userId') === event.source.userId && !row.get('qty'));

    if (userCart) {
      userCart.set('qty', qty);
      await userCart.save();

      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: 'เลือกทำรายการต่อ',
        template: {
          type: 'confirm',
          text: `บันทึกจำนวน ${qty} เรียบร้อยครับ\nต้องการสั่งอย่างอื่นเพิ่ม หรือชำระเงินเลย?`,
          actions: [
            { type: 'message', label: 'สั่งเพิ่ม', text: 'สั่งน้ำดื่ม' },
            { type: 'message', label: 'ชำระเงินเลย', text: 'สรุปยอดสั่งซื้อ' }
          ]
        }
      });
    }
  }

  // ข. พิมพ์ "สั่งน้ำดื่ม" เพื่อเริ่มใหม่
  if (userText === 'สั่งน้ำดื่ม') {
    const brandSheet = doc.sheetsByTitle['bland'];
    const brandRows = await brandSheet.getRows();
    const brandColumns = brandRows.map(row => ({
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png',
      action: {
        type: 'postback',
        label: `เลือก ${row.get('desc')}`, 
        data: `action=select_size&brand=${row.get('desc')}`
      }
    })).filter(col => col.action.label !== 'เลือก undefined').slice(0, 10);

    return client.replyMessage(event.replyToken, {
      type: 'template',
      altText: 'กรุณาเลือกยี่ห้อ',
      template: { type: 'image_carousel', columns: brandColumns }
    });
  }

  // ค. พิมพ์ "สรุปยอดสั่งซื้อ" -> คำนวณราคาและรัน ID ลงหน้า Order
  if (userText === 'สรุปยอดสั่งซื้อ') {
    const cartSheet = doc.sheetsByTitle['cart'];
    const orderSheet = doc.sheetsByTitle['Order'];
    const priceSheet = doc.sheetsByTitle['price'];
    
    const cartRows = await cartSheet.getRows();
    const userItems = cartRows.filter(row => row.get('userId') === event.source.userId);

    if (userItems.length === 0) return null;

    // รัน ID ต่อจากแถวเดิม
    const orderRows = await orderSheet.getRows();
    const nextId = orderRows.length + 1;

    let totalAmount = 0;
    let summaryText = "";
    let itemNames = [];

    for (const item of userItems) {
      const pRows = await priceSheet.getRows();
      const pRow = pRows.find(r => r.get('bland') === item.get('brand') && r.get('size') === item.get('size'));
      const price = pRow ? parseInt(pRow.get('price')) : 0;
      const subTotal = price * parseInt(item.get('qty'));
      
      totalAmount += subTotal;
      itemNames.push(`${item.get('brand')} ${item.get('size')} (x${item.get('qty')})`);
      summaryText += `- ${item.get('brand')} ${item.get('size')} x${item.get('qty')} = ${subTotal} บาท\n`;
      await item.delete(); // ล้างตะกร้า
    }

    await orderSheet.addRow({
      id: nextId,
      bland: itemNames.join(', '),
      total: totalAmount,
      status: 'รอชำระเงิน'
    });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `สรุปรายการสั่งซื้อ #${nextId}\n${summaryText}\n💰 ยอดรวม: ${totalAmount} บาท\n\nโอนเงินแล้วส่งสลิปได้เลยครับ!`
    });
  }
}
