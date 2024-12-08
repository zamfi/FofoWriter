// log message type has timestamp, type, and data

type LogMessage = {
    timestamp?: string; // in ISO format
    type: string;
    data: object;
    conditionData?: object;
};

const log = async (data: LogMessage) => {
    try {
        if (! data.timestamp) {
            data.timestamp = new Date().toISOString();
        }
        if (! data.conditionData) {
            // @ts-expect-error - Manually setting from global condition data
            data.conditionData = window.conditionData;
        }
        const response = await fetch('/api/log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            console.error('Failed to log data:', response.statusText);
            alert("Failed to log data. Please check the console for more information.");
        }
    } catch (error) {
        console.error('Error logging data:', error);
        alert("Failed to log data. Please check the console for more information.");
    }
};

export { log };