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
    
    // ประกาศตัวแปรที่ดึงจาก Postback Data ให้ครอบคลุมทุกเงื่อนไข
    const brand = params.get('brand'); 
    const size = params.get('size');

    // สเต็ปที่ 2: เลือกยี่ห้อเสร็จ -> ส่งรายการ "ขนาด" ให้เลือกต่อ
    if (action === 'select_size') {
      const sizeSheet = doc.sheetsByTitle['size'];
      const sizeRows = await sizeSheet.getRows();
      
      const sizeColumns = sizeRows.map(row => ({
        imageUrl: 'https://cdn-icons-png.flaticon.com/512/3105/3105807.png',
        action: {
          type: 'postback',
          label: `ขนาด ${row.get('desc')}`, 
          // ส่งค่า brand ต่อไปด้วยเพื่อให้ขั้นตอนถัดไปรู้ว่าเลือกยี่ห้ออะไร
          data: `action=confirm_option&brand=${brand}&size=${row.get('desc')}`
        }
      })).filter(col => col.action.label !== 'ขนาด undefined').slice(0, 10);

      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: 'กรุณาเลือกขนาด',
        template: { type: 'image_carousel', columns: sizeColumns }
      });
    }

    // สเต็ปที่ 3: เลือกขนาดเสร็จ -> บันทึกลงตะกร้าชั่วคราวและถามจำนวน
    if (action === 'confirm_option') {
      const cartSheet = doc.sheetsByTitle['cart'];
      // บันทึกเฉพาะข้อมูลที่มี เพื่อรอรับ 'qty' จากการพิมพ์ในภายหลัง
      await cartSheet.addRow({ 
        userId: event.source.userId, 
        brand: brand, 
        size: size 
      }); 

      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `คุณเลือก ${brand} ขนาด ${size}\n\n👉 กรุณาพิมพ์ "จำนวน" ที่ต้องการสั่งเป็นตัวเลขครับ`
      });
    }
  }

  // 2. ส่วนจัดการการพิมพ์ข้อความ
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userText = event.message.text;

  // ตรวจสอบว่าเป็นตัวเลขจำนวนหรือไม่ (เพื่อใส่ค่าลงในตะกร้า)
  const isNumber = /^\d+$/.test(userText);
  if (isNumber) {
    const cartSheet = doc.sheetsByTitle['cart'];
    const rows = await cartSheet.getRows();
    // ค้นหาแถวล่าสุดของลูกค้านี้ที่ยังไม่ได้ระบุจำนวน
    const userCart = rows.reverse().find(row => row.get('userId') === event.source.userId && !row.get('qty'));

    if (userCart) {
      userCart.set('qty', userText);
      await userCart.save();

      return client.replyMessage(event.replyToken, {
        type: 'template',
        altText: 'เลือกทำรายการต่อ',
        template: {
          type: 'confirm',
          text: `ใส่จำนวน ${userText} รายการเรียบร้อย\nต้องการสั่งเพิ่มหรือชำระเงินเลยครับ?`,
          actions: [
            { type: 'message', label: 'สั่งน้ำเพิ่ม', text: 'สั่งน้ำดื่ม' },
            { type: 'message', label: 'ชำระเงินเลย', text: 'ยืนยันการสั่งซื้อ' }
          ]
        }
      });
    }
  }

  // สเต็ปที่ 1: พิมพ์ "สั่งน้ำดื่ม"
  if (userText === 'สั่งน้ำดื่ม') {
    const brandSheet = doc.sheetsByTitle['bland']; // ตรวจสอบชื่อหน้า 'bland'
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

  // สเต็ปสุดท้าย: ยืนยันการสั่งซื้อ -> คำนวณยอดรวมและรัน ID ลงหน้า Order
  if (userText === 'ยืนยันการสั่งซื้อ') {
    const cartSheet = doc.sheetsByTitle['cart'];
    const orderSheet = doc.sheetsByTitle['Order']; // หน้า Order
    const priceSheet = doc.sheetsByTitle['price']; // หน้า price
    
    const cartRows = await cartSheet.getRows();
    const userItems = cartRows.filter(row => row.get('userId') === event.source.userId);

    if (userItems.length === 0) return null;

    const orderRows = await orderSheet.getRows();
    let nextId = orderRows.length + 1; // ระบบรัน ID อัตโนมัติ

    let summary = "รายการสั่งซื้อทั้งหมด:\n";
    let grandTotal = 0;
    let blandList = [];

    const pRows = await priceSheet.getRows();

    for (const item of userItems) {
      // ค้นหาราคาจากหน้า price โดยใช้ bland และ size
      const pRow = pRows.find(r => r.get('bland') === item.get('brand') && r.get('size') === item.get('size'));
      
      const price = pRow ? parseInt(pRow.get('price')) : 0;
      const qty = parseInt(item.get('qty') || 0);
      const total = price * qty;
      
      summary += `- ${item.get('brand')} ${item.get('size')} x ${qty} = ${total} บาท\n`;
      grandTotal += total;
      blandList.push(`${item.get('brand')} ${item.get('size')} (${qty})`);
      
      await item.delete(); // ล้างตะกร้าชั่วคราว
    }

    // บันทึกลงหน้า Order
    await orderSheet.addRow({
      id: nextId,
      bland: blandList.join(', '),
      total: grandTotal,
      status: 'รอชำระเงิน'
    });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `${summary}\n💰 ยอดรวมทั้งสิ้น: ${grandTotal} บาท\n\nโอนเงินแล้วกรุณาส่งหลักฐานการโอนได้เลยครับ!`
    });
  }
}
