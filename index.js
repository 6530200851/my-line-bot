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

  // 1. ส่วนจัดการการกดปุ่ม (Postback)
  if (event.type === 'postback') {
  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get('action');
  
  // ดึงค่าเหล่านี้ออกมาเพื่อใช้ในทุก Step ของ Postback
  const brand = params.get('brand');
  const size = params.get('size');
  
  // สเต็ปที่ 3: เมื่อกดยืนยันรายการ หรือ ชำระเงินผ่านปุ่ม Postback
  if (action === 'confirm_option') {
    // ดึงหน้า 'price' มาค้นหา
    const priceSheet = doc.sheetsByTitle['price']; 
    const priceRows = await priceSheet.getRows();

    // ค้นหาแถวที่ bland และ size ตรงกับที่เลือกมา
    const targetRow = priceRows.find(row => 
      row.get('bland') === brand && row.get('size') === size
    );

    const price = targetRow ? targetRow.get('price') : '0';

    return client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: `รายการ: ${brand} ${size}\nยอดชำระ: ${price} บาท\n\nโอนเงินได้ที่: ธนาคาร XXX เลขบัญชี 123-x-xxxxx-x`
      },
      {
        type: 'template',
        altText: 'ส่งสลิป',
        template: {
          type: 'buttons',
          text: 'กดปุ่มเพื่อแนบไฟล์สลิป',
          actions: [{
            type: 'uri',
            label: 'ส่งสลิป',
            uri: 'https://line.me/R/nv/cameraRoll/single'
          }]
        }
      }
    ]);
  }
}

  // 2. ส่วนจัดการการพิมพ์ข้อความ
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userText = event.message.text;

  // สเต็ปที่ 1: เลือกยี่ห้อ (Brand)
  if (userText === 'สั่งน้ำดื่ม') {
    // เปลี่ยนจาก index เป็นการระบุชื่อหน้าตรงๆ (เช่น 'Sheet1' หรือชื่อที่คุณตั้งไว้)
    const brandSheet = doc.sheetsByTitle['bland']; // *** เปลี่ยนชื่อให้ตรงกับใน Google Sheets ***
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

if (userText === 'ชำระเงิน') {
  // 1. ดึงข้อมูลจากหน้าชื่อ 'price'
  const priceSheet = doc.sheetsByTitle['price']; 
  const priceRows = await priceSheet.getRows();

  // 2. สร้าง ID เพื่อค้นหา (สมมติว่าคุณเก็บค่า idBland และ idSize ไว้จากการเลือกก่อนหน้า)
  // เช่น '1-1' หรือ 'B1-S1' ตามที่คุณต้องการต่อกัน
  const currentFullId = `${idBland}-${idSize}`; 

  // 3. ค้นหาแถวที่มี id ตรงกัน
  const targetRow = priceRows.find(row => row.get('id') === currentFullId);

  let summaryText = "รายการสั่งซื้อของคุณ:\n";
  let totalAmount = 0;

  if (targetRow) {
    const blandName = targetRow.get('bland'); // หัวตารางสะกด bland ตามรูป
    const sizeName = targetRow.get('size');
    const priceValue = parseInt(targetRow.get('price') || 0);

    summaryText += `- ${blandName} ${sizeName}: ${priceValue} บาท\n`;
    totalAmount = priceValue;
  } else {
    summaryText = "ขออภัย ไม่พบข้อมูลราคาสำหรับรายการนี้";
  }

  return client.replyMessage(event.replyToken, [
    {
      type: 'text',
      text: `${summaryText}\nยอดชำระทั้งหมด: ${totalAmount} บาท\n\nสามารถโอนเงินได้ที่:\nธนาคาร XXX\nเลขบัญชี 123-456-7890`
    },
    {
      type: 'template',
      altText: 'ส่งหลักฐานการชำระเงิน',
      template: {
        type: 'buttons',
        thumbnailImageUrl: 'https://cdn-icons-png.flaticon.com/512/2489/2489610.png',
        title: 'ชำระเงินเรียบร้อยแล้ว?',
        text: 'กรุณากดปุ่มด้านล่างเพื่อแนบไฟล์สลิป',
        actions: [
          {
            type: 'uri',
            label: 'กดเพื่อส่งสลิป',
            uri: 'https://line.me/R/nv/cameraRoll/single'
          }
        ]
      }
    }
  ]);
}
}
