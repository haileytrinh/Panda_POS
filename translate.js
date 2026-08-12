
const {Translate} = require('@google-cloud/translate').v2;

const translate = new Translate({
    keyFilename: process.env.GOOGLE_TRANSLATE_KEY_PATH // Specify the correct path
});

const translateText = async (text, targetLanguage) => {
    try {
        const [translation] = await translate.translate(text, targetLanguage);
        return translation;
    } catch (error) {
        throw new Error(error.message);
    }
};

module.exports = { translateText };

