exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { imageB64, mimeType } = JSON.parse(event.body);
    const isPDF = mimeType === 'application/pdf';

    const content = isPDF
      ? [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageB64 } },
          { type: 'text', text: 'זהה את כל פריטי החלונות בטבלה. החזר JSON מערך בלבד, ללא טקסט נוסף. פורמט: [{"apt":"838","loc":"מטבח","part":"7500","w":110,"h":250,"note":"תריס גלילה"}]' }
        ]
      : [
          { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageB64 } },
          { type: 'text', text: 'זהה את כל פריטי החלונות בטבלה. החזר JSON מערך בלבד, ללא טקסט נוסף. פורמט: [{"apt":"1","loc":"סלון","part":"7500","w":110,"h":250,"note":""}]' }
        ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: `אתה מזהה טבלאות חלונות. החזר JSON מערך בלבד ללא שום טקסט אחר.
שדות: apt (מספר דירה/מגרש), loc (חדר/חלל), part (סדרה/קוד), w (רוחב מ"מ), h (גובה מ"מ), note (תיאור+תריס).
אם כמות>1 צור שורה נפרדת לכל יחידה. אם אין דירה השתמש ב"1".`,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await res.json();

    if (data.error) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: data.error.message })
      };
    }

    const text = (data.content?.[0]?.text || '').trim();
    
    // חלץ JSON מהתשובה
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'לא זוהה JSON. תשובה: ' + text.substring(0, 300) })
      };
    }

    const items = JSON.parse(jsonMatch[0]);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, items })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
