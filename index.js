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
    const brand = params.get('brand');
    const size = params.get('size');

    // สเต็ปที่ 2: หลังจากเลือกยี่ห้อ (Brand) -> ให้เลือกขนาดต่อ (Size)
    if (action === 'select_size') {
      // เปลี่ยนจาก index เป็นการระบุชื่อหน้าตรงๆ (เช่น 'Sheet2' หรือชื่อที่คุณตั้งไว้)
      const sizeSheet = doc.sheetsByTitle['size']; // *** เปลี่ยนชื่อให้ตรงกับใน Google Sheets ***
      const sizeRows = await sizeSheet.getRows();
      
      const sizeColumns = sizeRows.map(row => {
        const sizeValue = row.get('desc'); 
        return {
          imageUrl: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png',
          action: {
            type: 'postback',
            label: `ขนาด ${sizeValue}`, 
            data: `action=confirm_option&brand=${brand}&size=${sizeValue}`
          }
        };
      }).filter(col => col.action.label !== 'ขนาด undefined').slice(0, 10);

      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: 'กรุณาเลือกขนาด',
        template: { type: 'image_carousel', columns: sizeColumns }
      });
    }

    // สเต็ปที่ 3: ยืนยันรายการ
    if (action === 'confirm_option') {
      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: 'ยืนยันรายการ',
        template: {
          type: 'confirm',
          text: `รายการที่เลือก: ${brand} ขนาด ${size}\nต้องการทำอะไรต่อ?`,
          actions: [
            { type: 'message', label: 'เลือกเพิ่ม', text: 'สั่งน้ำดื่ม' },
            { type: 'message', label: 'ชำระเงินเลย', text: 'ชำระเงิน' }
          ]
        }
      });
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
  // 1. ดึงข้อมูลจากหน้าที่เก็บรายการจับคู่ (หน้าที่ 3 หรือหน้าที่ชื่อ 'PriceList')
  const priceSheet = doc.sheetsByTitle['PriceList']; // *** เปลี่ยนชื่อให้ตรงกับหน้าที่มี ยี่ห้อ|ขนาด|ราคา ***
  const priceRows = await priceSheet.getRows();

  // ตัวอย่างนี้สมมติว่าคุณเก็บรายการที่ลูกค้าเลือกล่าสุดไว้ (หรือดึงจากฐานข้อมูลตะกร้าสินค้า)
  // ในที่นี้จะแสดงยอดรวมเบื้องต้น หรือยอดจากรายการล่าสุด
  let totalAmount = 0;
  let summaryText = "รายการสั่งซื้อของคุณ:\n";

  // สมมติค้นหาราคาจากรายการที่คุณเลือก (คุณอาจต้องปรับ Logic การเก็บตะกร้าสินค้าเพิ่ม)
  priceRows.forEach(row => {
    // ตัวอย่าง: ดึงราคาทั้งหมดมาแสดงเป็นรายการแนะนำ หรือคำนวณตามที่ลูกค้าเลือก
    summaryText += `- ${row.get('brand')} ${row.get('size')}: ${row.get('price')} บาท\n`;
    totalAmount += parseInt(row.get('price') || 0);
  });

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
            uri: 'https://line.me/R/nv/cameraRoll/single' // ลิงก์สำหรับเปิดอัลบั้มรูปใน LINE ทันที
          }
        ]
      }
    }
    
  ]);
}
}
