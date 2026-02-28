const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const { systemPrompt } = require('./knowledge-base');
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

// Environment variables you'll need to set in Render
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;
const FB_VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN || 'my_verify_token_123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';

// Initialize OpenAI with GitHub Models
const openai = new OpenAI({
  baseURL: "https://models.inference.ai.azure.com",
  apiKey: GITHUB_TOKEN,
});

// AI Response function using GitHub Models (FREE!)
async function getAIResponse(userMessage) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        { 
          role: 'user', 
          content: userMessage 
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 1,
    });

    const assistantMessage = response.choices[0].message.content;
    return assistantMessage || 'Désolé, je ne peux pas répondre pour le moment. Veuillez réessayer.';
    
  } catch (error) {
    console.error('AI Response Error:', error.message);
    return 'Désolé, une erreur s\'est produite. Veuillez réessayer plus tard.';
  }
}

// ============= FACEBOOK MESSENGER =============

// Facebook webhook verification
app.get('/webhook/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === FB_VERIFY_TOKEN) {
    console.log('Facebook webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Facebook webhook for receiving messages
app.post('/webhook/facebook', async (req, res) => {
  const body = req.body;

  if (body.object === 'page') {
    for (const entry of body.entry) {
      const webhookEvent = entry.messaging[0];
      const senderId = webhookEvent.sender.id;

      if (webhookEvent.message && webhookEvent.message.text) {
        const userMessage = webhookEvent.message.text;
        console.log(`FB Message from ${senderId}: ${userMessage}`);

        // Get AI response
        const aiResponse = await getAIResponse(userMessage);

        // Send response back to Facebook
        await sendFacebookMessage(senderId, aiResponse);
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Send message to Facebook user
async function sendFacebookMessage(recipientId, messageText) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/me/messages?access_token=${FB_PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: messageText }
      }
    );
    console.log('FB Message sent successfully');
  } catch (error) {
    console.error('Error sending FB message:', error.response?.data || error.message);
  }
}

// ============= WHATSAPP =============

// WhatsApp webhook verification
app.get('/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === FB_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp webhook for receiving messages
app.post('/webhook/whatsapp', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    for (const entry of body.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          for (const message of change.value.messages) {
            const from = message.from;
            const messageText = message.text?.body;

            if (messageText) {
              console.log(`WhatsApp Message from ${from}: ${messageText}`);

              // Get AI response
              const aiResponse = await getAIResponse(messageText);

              // Send response back to WhatsApp
              await sendWhatsAppMessage(from, aiResponse);
            }
          }
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

// Send message to WhatsApp user
async function sendWhatsAppMessage(to, messageText) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        text: { body: messageText }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('WhatsApp message sent successfully');
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
  }
}

// ============= SERVER =============

app.get('/', (req, res) => {
  res.send('AI Chatbot is running! 🤖');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
