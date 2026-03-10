import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function categorizeTransaction(description: string, amount: number): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Categoriza esta transacción bancaria: "${description}" por un monto de ${amount}€. 
      Devuelve las 3 categorías más probables de esta lista (Alimentación, Transporte, Entretenimiento, Salud, Hogar, Educación, Viajes, Compras, Servicios, Alquiler, Salario, Otros) separadas por comas. 
      Solo los nombres de las categorías.`,
    });
    const text = response.text?.trim() || "Varios";
    const categories = text.split(',').map(s => s.trim()).filter(s => s.length > 0);
    return categories.length > 0 ? categories : ["Varios"];
  } catch (error) {
    console.error("AI Categorization error:", error);
    return ["Varios"];
  }
}

export async function getFinancialAdvice(query: string, context: any) {
  try {
    // Pre-process context to make it more readable for the AI
    const summary = {
      transacciones_recientes: context.transactions?.map((t: any) => `${t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleDateString() : 'N/A'}: ${t.description} (${t.amount}€ - ${t.category})`).join('\n'),
      presupuestos: context.budgets?.map((b: any) => `${b.category}: ${b.amount}€`).join('\n'),
      inversiones: context.investments?.map((i: any) => `${i.symbol} (${i.name}): ${i.shares} acciones a ${i.currentPrice}€`).join('\n'),
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Consulta del usuario: ${query}
      
      CONTEXTO FINANCIERO DEL USUARIO:
      ---
      TRANSACCIONES RECIENTES:
      ${summary.transacciones_recientes || 'Sin transacciones registradas.'}
      
      PRESUPUESTOS ESTABLECIDOS:
      ${summary.presupuestos || 'Sin presupuestos establecidos.'}
      
      CARTERA DE INVERSIONES (IBEX 35):
      ${summary.inversiones || 'Sin inversiones registradas.'}
      ---`,
      config: {
        systemInstruction: `Eres "Smarty", el asistente financiero inteligente y cercano de SmartBudget Pro. 
        Tu misión es transformar datos financieros complejos en consejos fáciles de entender y aplicar.
        
        REGLAS DE ORO PARA LA COMPRENSIBILIDAD:
        1. **Lenguaje Humano**: Habla como un asesor financiero amigo. Evita la jerga bancaria pesada.
        2. **Estructura Visual**: Usa Markdown intensivamente. 
           - **Negritas** para cantidades de dinero y conceptos clave.
           - Listas con viñetas para desglosar gastos o consejos.
           - Tablas pequeñas si comparas datos (ej. presupuesto vs gasto real).
        3. **Emojis con Propósito**: Usa emojis para dar tono y facilitar la lectura (ej. 💰 para dinero, ⚠️ para alertas, ✅ para logros).
        4. **Accionable**: No te limites a describir. Di "Podrías ahorrar X si haces Y".
        5. **Empatía**: Si el usuario tiene pérdidas o gastos altos, sé comprensivo y ofrece un plan de acción positivo.
        6. **Brevedad**: Si la respuesta es larga, divídela en secciones claras con títulos.
        
        ESTRUCTURA DE RESPUESTA:
        - **Resumen Rápido**: Una frase que responda directamente a la pregunta.
        - **Análisis de Datos**: Qué dicen sus números (transacciones, presupuestos, etc.).
        - **Plan de Acción**: 2-3 pasos concretos que el usuario puede tomar hoy mismo.
        - **Pregunta de Cierre**: Una pregunta que invite a seguir analizando sus finanzas.
        
        Responde siempre en español de España.`,
      }
    });
    return response.text || "Lo siento, no pude procesar eso en este momento.";
  } catch (error) {
    console.error("AI Advice error:", error);
    return "Tengo problemas para conectar con mi cerebro en este momento.";
  }
}

export async function getSpendingAnalysis(context: any) {
  try {
    const summary = {
      transacciones: context.transactions?.map((t: any) => `${t.date?.seconds ? new Date(t.date.seconds * 1000).toLocaleDateString() : 'N/A'}: ${t.description} (${t.amount}€ - ${t.category})`).join('\n'),
      presupuestos: context.budgets?.map((b: any) => `${b.category}: ${b.amount}€`).join('\n'),
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Realiza un análisis profundo de mis patrones de gasto y sugiéreme categorías de ahorro.
      
      MIS DATOS:
      ---
      TRANSACCIONES:
      ${summary.transacciones || 'Sin transacciones.'}
      
      PRESUPUESTOS:
      ${summary.presupuestos || 'Sin presupuestos.'}
      ---`,
      config: {
        systemInstruction: `Eres un Analista Financiero Experto. Tu objetivo es encontrar patrones ocultos en los gastos del usuario y proponer estrategias de ahorro agresivas pero realistas.
        
        ESTRUCTURA DEL ANÁLISIS:
        1. **Patrones Detectados**: Identifica gastos recurrentes, picos de gasto o categorías que consumen demasiado presupuesto.
        2. **Categorías de Ahorro Sugeridas**: Propón 2-3 categorías donde el usuario podría recortar gastos basándote en sus datos reales.
        3. **Reto de Ahorro**: Crea un pequeño reto para la próxima semana (ej. "Semana sin cenas fuera").
        
        Usa un tono profesional, motivador y directo. Usa Markdown para que el análisis sea visualmente atractivo.`,
      }
    });
    return response.text || "No pude generar el análisis en este momento.";
  } catch (error) {
    console.error("AI Analysis error:", error);
    return "Error al analizar los patrones de gasto.";
  }
}
