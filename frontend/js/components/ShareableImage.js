// js/components/ShareableImage.js

// Use React globals provided by the script tags
const { useState, useRef, useEffect } = React;

// ShareableImage component for generating high-quality social media images
const ShareableImage = (props) => {
    console.log("ShareableImage - Component initializing with props:", {
        questionSample: props.question ? props.question.substring(0, 30) : null,
        totalVotes: props.totalVotes,
        dateSample: props.date,
        answersCount: props.answers ? props.answers.length : 0,
        autoGenerate: props.autoGenerate
    });
    
    // Destructure props with defaults
    const question = props.question || "What's your favorite board game?";
    const totalVotes = props.totalVotes || 37;
    const date = props.date || "May 14, 2025";
    const answers = props.answers || [
        { answer: "Settlers of Catan", voteCount: 8 },
        { answer: "Monopoly", voteCount: 7 },
        { answer: "Scrabble", voteCount: 6 },
        { answer: "Chess", voteCount: 5 },
        { answer: "Risk", voteCount: 4 }
    ];
    const onImageGenerated = props.onImageGenerated || null;
    const autoGenerate = !!props.autoGenerate;

    const [generatedImage, setGeneratedImage] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [renderComplete, setRenderComplete] = useState(false);
    const [fontLoaded, setFontLoaded] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const imageContainerRef = useRef(null);

    // Calculate the percentage for each answer for the progress bars
    const totalTopVotes = answers.reduce((sum, answer) => sum + answer.voteCount, 0);
    const answersWithPercentage = answers.map(answer => ({
        ...answer,
        percentage: Math.round((answer.voteCount / totalTopVotes) * 100)
    }));

    // Function to generate the image from the component using the globally available html2canvas
    const generateImage = async () => {
        console.log("ShareableImage - generateImage called");
        
        if (!window.html2canvas) {
            console.error("ShareableImage - ERROR: html2canvas not found in window object");
            return;
        }
        
        if (!imageContainerRef.current) {
            console.error("ShareableImage - ERROR: Container ref is missing");
            return;
        }

        try {
            console.log("ShareableImage - Starting image generation process...");
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

            console.log("ShareableImage - Configured element for capture, dimensions:", {
                width: cardElement.offsetWidth,
                height: cardElement.offsetHeight
            });
            
            console.log("ShareableImage - Calling html2canvas...");
            
            // Configure html2canvas with higher quality settings
            const canvas = await html2canvas(cardElement, {
                scale: 3, // Higher scale for better quality
                useCORS: true, // Use CORS to handle images from different origins
                logging: true, // Enable logging for debugging
                backgroundColor: '#ffffff',
                allowTaint: true, // Allow taint for the logo
                removeContainer: false,
                letterRendering: true, // Improves text rendering quality
                imageTimeout: 0, // No timeout for image loading
                x: 0,
                y: 0,
                width: cardElement.offsetWidth,
                height: cardElement.offsetHeight
            });

            console.log("ShareableImage - Canvas generated successfully");

            // Restore original scaling for UI display
            cardElement.style.transform = originalTransform;
            cardElement.style.transformOrigin = originalTransformOrigin;
            cardElement.style.marginBottom = originalMarginBottom;

            // Convert canvas to image URL with maximum quality
            const imageUrl = canvas.toDataURL('image/png', 1.0);
            console.log("ShareableImage - Image URL generated");
            setGeneratedImage(imageUrl);

            // If a callback was provided, call it with the generated image
            if (onImageGenerated && typeof onImageGenerated === 'function') {
                console.log("ShareableImage - Calling onImageGenerated callback...");
                try {
                    // Convert the data URL to a Blob for easier upload
                    const response = await fetch(imageUrl);
                    const imageBlob = await response.blob();
                    console.log("ShareableImage - Image blob created, size:", imageBlob.size);
                    
                    // Call the callback
                    onImageGenerated(imageBlob, imageUrl);
                } catch (blobError) {
                    console.error("ShareableImage - ERROR in blob conversion:", blobError);
                }
            } else {
                console.warn("ShareableImage - No onImageGenerated callback provided");
            }
        } catch (error) {
            console.error("ShareableImage - ERROR generating image:", error);
        } finally {
            console.log("ShareableImage - Image generation process completed");
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

        try {
            // Create date object from YYYY-MM-DD string
            const date = new Date(dateString + 'T00:00:00'); // Add time to ensure consistent parsing

            // Format to match the main website's style
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error("ShareableImage - Error formatting date:", error);
            return dateString;
        }
    };

    // Handle logo image loading
    const handleLogoLoad = () => {
        console.log("ShareableImage - Logo image loaded successfully");
        setImageLoaded(true);
    };

    // Handle logo image error
    const handleLogoError = (error) => {
        console.error("ShareableImage - Error loading logo image:", error);
        // Mark as loaded anyway to not block the process
        setImageLoaded(true);
    };

    // Monitor when the component has finished rendering
    useEffect(() => {
        // This runs after render is complete
        console.log("ShareableImage - Component rendered");
        setRenderComplete(true);
    }, []);

    // Ensure font is loaded
    useEffect(() => {
        console.log("ShareableImage - Font loading effect triggered");
        
        // Check if the Google Fonts API link is already in the document
        const fontLink = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Libre+Franklin"]');

        // If it's not already in the document, add it
        if (!fontLink) {
            console.log("ShareableImage - Adding Libre Franklin font link");
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;700&display=swap';
            document.head.appendChild(link);
        } else {
            console.log("ShareableImage - Libre Franklin font link already exists");
        }

        // Set a timeout to mark fonts as loaded even if the proper API isn't available
        const timeoutId = setTimeout(() => {
            console.log("ShareableImage - Font loading timeout reached, marking as loaded");
            setFontLoaded(true);
        }, 2000);

        // Try to use the proper font loading API if available
        if (document.fonts && typeof document.fonts.ready === 'object' && document.fonts.ready.then) {
            console.log("ShareableImage - Using document.fonts.ready API");
            document.fonts.ready
                .then(() => {
                    console.log("ShareableImage - Fonts loaded successfully via API");
                    clearTimeout(timeoutId);
                    setFontLoaded(true);
                })
                .catch(function(err) {
                    console.error("ShareableImage - Error in font loading API:", err);
                    // Mark as loaded anyway to not block the process
                    setFontLoaded(true);
                });
        } else {
            console.warn("ShareableImage - document.fonts.ready API not available, using timeout");
        }

        return () => clearTimeout(timeoutId);
    }, []);

    // Add effect for auto-generation when the component is ready
    useEffect(() => {
        const componentReady = renderComplete && (fontLoaded || !document.fonts) && (imageLoaded || !imageContainerRef.current);
        console.log("ShareableImage - Component ready status:", {
            autoGenerate, renderComplete, fontLoaded, imageLoaded, componentReady
        });
        
        if (autoGenerate && componentReady && imageContainerRef.current) {
            console.log("ShareableImage - Starting auto-generation with delay...");
            // Use a slight delay to ensure rendering is complete
            const timer = setTimeout(() => {
                console.log("ShareableImage - Auto-generation delay completed, generating image");
                generateImage();
            }, 2000);
            
            return function() { clearTimeout(timer); };
        }
    }, [autoGenerate, renderComplete, fontLoaded, imageLoaded]);

    // Function to capitalize each word in a string
    const capitalizeWords = (text) => {
        return text.replace(/\b\w/g, function(char) { return char.toUpperCase(); });
    };

    console.log("ShareableImage - Rendering component, container ref exists:", !!imageContainerRef.current);

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
                            onLoad={handleLogoLoad}
                            onError={handleLogoError}
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
                            What did <span style={{ fontWeight: 'bold' }}>{totalVotes} people</span> say was {question}
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
                            {answersWithPercentage.map(function(answer, index) {
                                return (
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
                                );
                            })}
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

            {/* Only show controls if not in auto-generate mode */}
            {!autoGenerate && (
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
            )}

            {/* Only show preview if not in auto-generate mode and an image has been generated */}
            {!autoGenerate && generatedImage && (
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