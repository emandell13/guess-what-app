// js/components/ShareableImage.js

// Use React globals provided by the script tags
const { useState, useRef, useEffect } = React;

// ShareableImage component for generating high-quality social media images
const ShareableImage = ({
    question = "What's your favorite board game?",
    totalVotes = 37,
    date = "May 14, 2025", // Default date without day of week
    answers = [
        { answer: "Settlers of Catan", voteCount: 8 },
        { answer: "Monopoly", voteCount: 7 },
        { answer: "Scrabble", voteCount: 6 },
        { answer: "Chess", voteCount: 5 },
        { answer: "Risk", voteCount: 4 }
    ],
    onImageGenerated = null
}) => {
    const [generatedImage, setGeneratedImage] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const imageContainerRef = useRef(null);

    // Calculate the percentage for each answer for the progress bars
    const totalTopVotes = answers.reduce((sum, answer) => sum + answer.voteCount, 0);
    const answersWithPercentage = answers.map(answer => ({
        ...answer,
        percentage: Math.round((answer.voteCount / totalTopVotes) * 100)
    }));

    // Function to generate the image from the component using the globally available html2canvas
    const generateImage = async () => {
        if (!imageContainerRef.current || !window.html2canvas) {
            console.error("html2canvas not found or container ref is missing");
            return;
        }

        try {
            setIsGenerating(true);

            // Before capture, temporarily apply actual size without scaling for better quality
            const cardElement = imageContainerRef.current;
            const originalTransform = cardElement.style.transform;
            const originalTransformOrigin = cardElement.style.transformOrigin;
            const originalMarginBottom = cardElement.style.marginBottom;

            // Temporarily remove scaling
            cardElement.style.transform = 'none';
            cardElement.style.transformOrigin = 'top left';
            cardElement.style.marginBottom = '0';

            // Configure html2canvas with higher quality settings
            const canvas = await window.html2canvas(cardElement, {
                scale: 3, // Higher scale for better quality
                useCORS: true, // Use CORS to handle images from different origins
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true, // May need to allow taint for the logo
                removeContainer: false,
                letterRendering: true, // Improves text rendering quality
                imageTimeout: 0, // No timeout for image loading
                x: 0,
                y: 0,
                width: cardElement.offsetWidth,
                height: cardElement.offsetHeight
            });

            // Restore original scaling for UI display
            cardElement.style.transform = originalTransform;
            cardElement.style.transformOrigin = originalTransformOrigin;
            cardElement.style.marginBottom = originalMarginBottom;

            // Convert canvas to image URL with maximum quality
            const imageUrl = canvas.toDataURL('image/png', 1.0);
            setGeneratedImage(imageUrl);

            // If a callback was provided, call it with the generated image
            if (onImageGenerated && typeof onImageGenerated === 'function') {
                // Convert the data URL to a Blob for easier upload
                const imageBlob = await (await fetch(imageUrl)).blob();
                onImageGenerated(imageBlob, imageUrl);
            }
        } catch (error) {
            console.error("Error generating image:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    // Function to download the generated image
    const downloadImage = () => {
        if (!generatedImage) return;

        const link = document.createElement('a');
        link.href = generatedImage;
        link.download = `guess-what-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Function to format date the same way as the main website
    const formatDateForDisplay = (dateString) => {
        // If it's already in the format we want or not a valid date string, return as is
        if (!dateString || !dateString.includes('-')) return dateString;

        // Create date object from YYYY-MM-DD string
        const date = new Date(dateString + 'T00:00:00'); // Add time to ensure consistent parsing

        // Format to match the main website's style
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Ensure font is loaded
    useEffect(() => {
        // Check if the Google Fonts API link is already in the document
        const fontLink = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Libre+Franklin"]');

        // If it's not already in the document, add it
        if (!fontLink) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;700&display=swap';
            document.head.appendChild(link);
        }

        // Log the date we received for debugging
        console.log("Date received from backend:", date);
    }, [date]);

    // Function to capitalize each word in a string
    const capitalizeWords = (text) => {
        return text.replace(/\b\w/g, char => char.toUpperCase());
    };

    return (
        <div className="shareable-image-generator">
            {/* The component to be rendered as an image */}
            <div className="shareable-image-container mb-4">
                <div
                    ref={imageContainerRef}
                    className="shareable-card"
                    style={{
                        width: '1080px', // Square format for Instagram
                        height: '1080px',
                        backgroundColor: '#ffffff',
                        padding: '50px', // Keeping the padding all around
                        color: '#000000',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between', // Evenly space the four main elements
                        alignItems: 'center', // Center everything horizontally
                        // Scale to fit screens for preview only (doesn't affect generation)
                        transform: 'scale(0.4)',
                        transformOrigin: 'top left',
                        marginBottom: '650px',
                        fontFamily: 'Libre Franklin, Arial, sans-serif'
                    }}
                >
                    {/* Logo - as its own section */}
                    <div style={{
                        textAlign: 'center',
                        paddingTop: '20px',  // Add some padding from the top
                        paddingBottom: '20px' // Add some padding at the bottom
                    }}>
                        <img
                            src="/images/logo.svg"
                            alt="Guess What!"
                            style={{ width: '180px', height: 'auto' }}
                            crossOrigin="anonymous"
                        />
                    </div>

                    {/* Date and Question section */}
                    <div style={{
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        paddingTop: '20px',
                        paddingBottom: '20px'
                    }}>
                        {/* Date - Use exactly what's passed from the backend */}
                        <div style={{
                            fontSize: '24px',
                            fontFamily: 'Libre Franklin, Arial, sans-serif',
                            marginBottom: '25px',
                            color: '#333333'
                        }}>
                            {formatDateForDisplay(date)}
                        </div>

                        {/* Question */}
                        <div style={{
                            fontSize: '40px',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            maxWidth: '850px',
                            lineHeight: 1.2,
                            fontFamily: 'Libre Franklin, Arial, sans-serif'
                        }}>
                            What did <span style={{ fontWeight: 'bold' }}>{totalVotes} people</span> say was {question}?
                        </div>
                    </div>

                    {/* Answer Boxes section - Centered properly */}
                    <div style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center', // Center the answer container horizontally
                        paddingTop: '20px',
                        paddingBottom: '20px'
                    }}>
                        {/* Answers container with fixed width */}
                        <div style={{
                            width: '100%',
                            maxWidth: '850px', // Fixed width for consistent sizing
                        }}>
                            {answersWithPercentage.map((answer, index) => (
                                <div key={index} style={{
                                    marginBottom: index < answersWithPercentage.length - 1 ? '16px' : '0',
                                    backgroundColor: '#CBE5D9',
                                    borderRadius: '12px',
                                    border: '2px solid #A6CCBB',
                                    padding: '16px 24px',
                                    textAlign: 'center',
                                    position: 'relative'
                                }}>
                                    {/* Three-column layout with flexbox */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}>
                                        {/* Number (Left) */}
                                        <div style={{
                                            fontSize: '28px',
                                            fontWeight: 'bold',
                                            fontFamily: 'Libre Franklin, Arial, sans-serif',
                                            width: '50px',
                                            textAlign: 'left'
                                        }}>
                                            {index + 1}
                                        </div>

                                        {/* Answer (Center) */}
                                        <div style={{
                                            fontSize: '28px',
                                            fontWeight: 'bold',
                                            fontFamily: 'Libre Franklin, Arial, sans-serif',
                                            flex: 1,
                                            textAlign: 'center',
                                            padding: '0 15px'
                                        }}>
                                            {capitalizeWords(answer.answer)}
                                        </div>

                                        {/* Vote Count (Right) */}
                                        <div style={{
                                            fontSize: '22px',
                                            fontWeight: 'bold',
                                            fontFamily: 'Libre Franklin, Arial, sans-serif',
                                            width: '110px',
                                            textAlign: 'right'
                                        }}>
                                            {answer.voteCount} {answer.voteCount === 1 ? 'Vote' : 'Votes'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer section */}
                    <div style={{
                        fontSize: '26px',
                        fontFamily: 'Libre Franklin, Arial, sans-serif',
                        color: '#555555',
                        textAlign: 'center',
                        paddingTop: '20px',
                        paddingBottom: '20px'
                    }}>
                        Play today at <span style={{ fontWeight: 'bold' }}>playguesswhat.com</span>!
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="controls mb-4">
                <button
                    className="btn btn-primary me-2"
                    onClick={generateImage}
                    disabled={isGenerating}
                >
                    {isGenerating ? 'Generating...' : 'Generate Image'}
                </button>

                {generatedImage && (
                    <button
                        className="btn btn-success"
                        onClick={downloadImage}
                    >
                        Download Image
                    </button>
                )}
            </div>

            {/* Preview */}
            {generatedImage && (
                <div className="image-preview mb-3">
                    <h5>Preview:</h5>
                    <img
                        src={generatedImage}
                        alt="Generated social media image"
                        style={{ maxWidth: '100%', border: '1px solid #ddd', borderRadius: '8px' }}
                    />
                </div>
            )}
        </div>
    );
};

// Expose the component globally since we're not using ES modules in the browser context
window.ShareableImage = ShareableImage;