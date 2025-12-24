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

// ฟังก์ชั่นทำงาน
// async function handleEvent(event) {
//   // 1. จัดการการกดที่รูปภาพ (Postback)
//   if (event.type === 'postback') {
//     const data = event.postback.data; // ตรงนี้จะได้รับค่า 'action=select_brand&item=BrandA'
//     // เพิ่มโค้ดสำหรับตอบกลับขนาดน้ำต่อที่นี่...
//     return client.replyMessage(event.replyToken, { 
//       type: 'text', 
//       text: `คุณได้เลือกยี่ห้อ ${data.includes('BrandA') ? 'คริสตัล' : 'สิงห์'} เรียบร้อยครับ` 
//     });
//   }

//   // 2. จัดการข้อความพิมพ์ (Message)
//   if (event.type !== 'message' || event.message.type !== 'text') {
//     return Promise.resolve(null);
//   }

//   const userText = event.message.text;

//   // ถ้าลูกค้ากดปุ่ม "สั่งน้ำ" จาก Rich Menu หรือพิมพ์เข้ามา
//   if (userText === 'เมนู' || userText === 'สั่งน้ำ' || userText === 'สั่งน้ำดื่ม') {
//     return client.replyMessage(event.replyToken, {
//       type: 'template',
//       altText: 'กรุณาเลือกยี่ห้อน้ำดื่ม',
//       template: {
//         type: 'image_carousel',
//         columns: [
//           {
//             // เปลี่ยนลิงก์ด้านล่างเป็นลิงก์รูปภาพบนอินเทอร์เน็ต (HTTPS)
//             imageUrl: 'https://bangpleestationery.com/wp-content/uploads/2023/04/%E0%B8%99%E0%B9%89%E0%B8%B3%E0%B8%84%E0%B8%A3%E0%B8%B4%E0%B8%AA%E0%B8%95%E0%B8%B1%E0%B8%A5.jpg', 
//             action: { type: 'postback', data: 'action=select_brand&item=BrandA', label: 'ยี่ห้อ คริสตัล' }
//           },
//           {
//             imageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPMVhMOKc6jIJP0GTzj_l8tpGs7ZPsUXRx9Q&s', 
//             action: { type: 'postback', data: 'action=select_brand&item=BrandB', label: 'ยี่ห้อ สิงห์' }
//           }
//         ]
//       }
//     });
//   }

//   // ข้อความตอบกลับปกติ
//   return client.replyMessage(event.replyToken, {
//     type: 'text',
//     text: 'กดที่เมนูด้านล่าง หรือพิมพ์คำว่า "เมนู" เพื่อสั่งน้ำได้เลยครับ',
//   });

// }

async function handleEvent(event) {
  // --- ส่วนโหลดข้อมูลจาก Google Sheets ---
  const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0]; // เลือก Sheet หน้าแรก
  const rows = await sheet.getRows(); // ดึงข้อมูลทุกแถว
  
  // 1. จัดการการกดที่รูปภาพ (Postback)
  if (event.type === 'postback') {
    const data = event.postback.data; 
    return client.replyMessage(event.replyToken, { 
      type: 'text', 
      text: `บันทึกข้อมูล: ${data} เรียบร้อยครับ` 
    });
  }

  // 2. จัดการข้อความพิมพ์
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userText = event.message.text;

  if (userText === 'สั่งน้ำดื่ม') {
    // สร้างรายการคอลัมน์จากข้อมูลใน Sheet (คอลัมน์ desc ในรูป image_53be67.png)
    const columns = rows.map(row => ({
      imageUrl: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png', // รูปเริ่มต้น
      action: { 
        type: 'postback', 
        label: `เลือก ${row.get('desc')}`, 
        data: `item=${row.get('desc')}` 
      }
    })).slice(0, 10); // LINE จำกัดสูงสุด 10 รูป

    return client.replyMessage(event.replyToken, {
      type: 'template',
      altText: 'กรุณาเลือกรายการน้ำดื่ม',
      template: {
        type: 'image_carousel',
        columns: columns
      }
    });
  }
}

