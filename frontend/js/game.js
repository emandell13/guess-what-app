import {
        saveTodayGuesses,
        getTodayGuesses,
        markTodayCompleted,
        saveTodayStrikes,
        getTodayStrikes
    } from './utils/sessionUtils.js';

class Game {
    constructor(ui) {
        // Game state
        this.correctGuesses = [];
        this.maxPoints = 0;
        this.currentScore = 0;
        this.strikes = 0;
        this.MAX_STRIKES = 3;
        this.ui = ui;

        // DOM elements
        this.currentScoreSpan = document.getElementById("current-score");
        this.maxScoreSpan = document.getElementById("max-score");
        this.strikesDiv = document.getElementById("strikes");
    }

    // Load any previously saved guesses for today
    restoreGameState() {
        // Load saved guesses
        const savedGuesses = getTodayGuesses();
        
        if (savedGuesses && savedGuesses.length > 0) {
          // Restore saved guesses
          this.correctGuesses = savedGuesses;
          
          // Calculate restored score
          this.currentScore = savedGuesses.reduce((sum, guess) => sum + (guess.points || 0), 0);
          
          // Update UI
          if (this.currentScoreSpan) {
            this.currentScoreSpan.textContent = this.currentScore;
          }
        }
        
        // Load saved strikes
        const savedStrikes = getTodayStrikes();
        if (savedStrikes > 0) {
          // Restore strikes count
          this.strikes = savedStrikes;
          
          // Update UI to show strikes
          for (let i = 0; i < this.strikes; i++) {
            const strikeIcons = this.strikesDiv.querySelectorAll('i');
            const icon = strikeIcons[i];
            if (icon) {
              icon.classList.replace('far', 'fas');
              icon.classList.add('text-danger');
            }
          }
        }
        
        // Only reveal answers after strike UI is updated
        if (savedGuesses && savedGuesses.length > 0 && this.ui && this.ui.answerBoxesContainer) {
          // Make sure answer boxes exist before trying to update them
          if (this.ui.answerBoxesContainer.children.length > 0) {
            // Visually update UI to show already guessed answers
            this.correctGuesses.forEach(guess => {
              this.ui.revealAnswer(guess.rank, guess.guess, guess.points);
            });
          }
        }
      }

    async fetchTodaysQuestion() {
        try {
            const response = await fetch("/guesses/question");
            const data = await response.json();
            
            if (data.question) {
                // Set the question text with vote count
                document.querySelector("h2").textContent = 
                    `Guess what ${data.totalVotes} people said was ${data.guessPrompt}!`;
                
                // Set max score
                this.maxPoints = data.maxPoints;
                this.maxScoreSpan.textContent = this.maxPoints;
                
                // Store the answer count for later use
                this.answerCount = data.answerCount || 5;
                
                return {
                    success: true,
                    answerCount: this.answerCount
                };
            } else {
                document.querySelector("h2").textContent = "No question available for guessing yet";
                return {
                    success: false
                };
            }
        } catch (error) {
            console.error("Error fetching today's question:", error);
            return {
                success: false
            };
        }
    }

    async fetchTopAnswers() {
        try {
            const response = await fetch("/guesses/top-answers");
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0) {
                return {
                    success: true,
                    answers: data.data
                };
            } else {
                console.error("No top answers found");
                return {
                    success: false
                };
            }
        } catch (error) {
            console.error("Error fetching top answers:", error);
            return {
                success: false
            };
        }
    }

    // Updated addStrike method
    addStrike() {
        this.strikes++;
        const strikeIcons = this.strikesDiv.querySelectorAll('i');
        const icon = strikeIcons[this.strikes - 1];
        icon.classList.replace('far', 'fas');
        icon.classList.add('text-danger', 'strike-reveal');
        
        // Save strikes to session storage
        saveTodayStrikes(this.strikes);
        
        const maxStrikesReached = this.strikes >= this.MAX_STRIKES;
        
        // Mark game as completed if max strikes reached
        if (maxStrikesReached) {
            markTodayCompleted();
        }
        
        return maxStrikesReached;
    }

    isGameOver() {
        // Default to 5 if answerCount is not set
        const totalAnswers = this.answerCount || 5;
        
        // Game is over if MAX_STRIKES reached or all answers are found
        const allAnswersFound = this.correctGuesses.length >= totalAnswers;
        const struckOut = this.strikes >= this.MAX_STRIKES;
        
        return struckOut || allAnswersFound;
    }

    // Updated recordCorrectGuess method
    recordCorrectGuess(guess, rank, points, canonicalAnswer) {
        // Check if this rank has already been guessed
        const alreadyGuessed = this.correctGuesses.some(g => g.rank === rank);
        
        // If already guessed, return false (not a new correct guess)
        if (alreadyGuessed) {
            return false;
        }
        
        // Update score
        this.updateScore(points);
        
        // Add the guess with points information
        const guessInfo = {
            guess: canonicalAnswer || guess,
            rank,
            points
        };
        
        this.correctGuesses.push(guessInfo);
        
        // Save progress
        saveTodayGuesses(this.correctGuesses);
        
        // Check if game is complete based on actual answer count
        const totalAnswers = this.answerCount || 5;
        const gameComplete = this.correctGuesses.length >= totalAnswers;
        
        if (gameComplete) {
            markTodayCompleted();
        }
            
        return gameComplete;
    }

    updateScore(points) {
        this.currentScore += points;
        this.currentScoreSpan.textContent = this.currentScore;
    }
}

export default Game;