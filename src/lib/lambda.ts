export interface CalcResponse {
  expression: string;
  result: string;
  steps: string;
}

export async function solveProblem(
  text: string,
  imageBase64?: string
): Promise<CalcResponse> {
  // Replace with your Lambda function URL
  const LAMBDA_URL = 'https://cdyibmzy64skc2ikp74qebsicq0nggic.lambda-url.us-east-1.on.aws/';

  try {
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        image: imageBase64,
      }),
    });

    if (!response.ok) {
      throw new Error(`Lambda error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error calling Lambda:', error);
    throw error;
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get just base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
