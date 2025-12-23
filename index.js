const express = require('express'); // ห้ามลืมบรรทัดนี้!
const line = require('@line/bot-sdk');
require('dotenv').config();

const app = express(); // นี่คือตัวที่ Error บอกว่าหายไปครับ

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || 'ใส่_Token_ใน_ไฟล์_env_นะ',
  channelSecret: process.env.CHANNEL_SECRET || 'ใส่_Secret_ใน_ไฟล์_env_นะ',
};

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

async function handleEvent(event) {
  // 1. จัดการการกดที่รูปภาพ (Postback)
  if (event.type === 'postback') {
    const data = event.postback.data; // ตรงนี้จะได้รับค่า 'action=select_brand&item=BrandA'
    // เพิ่มโค้ดสำหรับตอบกลับขนาดน้ำต่อที่นี่...
    return client.replyMessage(event.replyToken, { 
      type: 'text', 
      text: `คุณได้เลือกยี่ห้อ ${data.includes('BrandA') ? 'คริสตัล' : 'สิงห์'} เรียบร้อยครับ` 
    });
  }

  // 2. จัดการข้อความพิมพ์ (Message)
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text;

  // ถ้าลูกค้ากดปุ่ม "สั่งน้ำ" จาก Rich Menu หรือพิมพ์เข้ามา
  if (userText === 'เมนู' || userText === 'สั่งน้ำ' || userText === 'สั่งน้ำดื่ม') {
    return client.replyMessage(event.replyToken, {
      type: 'template',
      altText: 'กรุณาเลือกยี่ห้อน้ำดื่ม',
      template: {
        type: 'image_carousel',
        columns: [
          {
            // เปลี่ยนลิงก์ด้านล่างเป็นลิงก์รูปภาพบนอินเทอร์เน็ต (HTTPS)
            imageUrl: 'https://images.unsplash.com/photo-1559839914-17aae19cea9e?w=500', 
            action: { type: 'postback', data: 'action=select_brand&item=BrandA', label: 'ยี่ห้อ คริสตัล' }
          },
          {
            imageUrl: 'https://images.unsplash.com/photo-1559839914-17aae19cea9e?w=500', 
            action: { type: 'postback', data: 'action=select_brand&item=BrandB', label: 'ยี่ห้อ สิงห์' }
          }
        ]
      }
    });
  }

  // ข้อความตอบกลับปกติ
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'กดที่เมนูด้านล่าง หรือพิมพ์คำว่า "เมนู" เพื่อสั่งน้ำได้เลยครับ',
  });

}
