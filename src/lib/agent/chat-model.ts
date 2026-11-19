// The OpenAI model for typed chat (website concierge and widget), for every studio.
// Set it with OPENAI_MODEL in the environment; the OpenAI project behind OPENAI_API_KEY must allow it.
// Phone and voice calls use the model set on the saved assistant in the Vapi dashboard instead.
export const chatModel = () => process.env.OPENAI_MODEL?.trim() || "gpt-5.6-terra";
