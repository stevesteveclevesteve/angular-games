import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NgStyle } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, map, Observable, of } from 'rxjs';

@Component({
    selector: 'wordley-durdley',
    imports: [NgStyle, FormsModule],
    templateUrl: './wordley-durdley.component.html',
    styleUrl: './wordley-durdley.component.css',
    standalone: true
})
export class WordleyDurdleyComponent implements OnInit {
  title = 'wordleydurdley';
  grid;
  hitStatuses = ['correct', 'present'];
  private http = inject(HttpClient);
  private _correctAnswer: string = '';

  guessValue: string = '';
  guesses: string[] = [];
  invalidGuess = false;

  showMessage = false;
  messageText = '';
  messageAngle = 0;

  constructor() {
    this.grid = Array.from({ length: 6 }, () => Array(5).fill({ letter: '', status: '', index: 0 }));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 5; j++) {
        this.grid[i][j] = { letter: '', status: '', index: j };
      }
    }
  }

  ngOnInit(): void {
    this.http.get<string[]>('https://random-word-api.herokuapp.com/word', { params: { length: '5' } })
      .subscribe((data: string[]) => {
        this._correctAnswer = data[0].toUpperCase();
      });
    this.setMessage();
  }

  get correctAnswer(): string {
    return this._correctAnswer;
  }

  get guessWasCorrect(): boolean {
    return this.guesses.length > 0 && this.guesses[this.guesses.length - 1] === this.correctAnswer;
  }

  get canReset(): boolean {
    return this.guessWasCorrect || this.guesses.length >= 6;
  }

  displayMessage(text: string, timeout: number = 2200) {
    this.messageText = text;
    this.messageAngle = Math.floor(Math.random() * 81) - 40; // -40 to 40
    this.showMessage = true;
    setTimeout(() => this.showMessage = false, 2200); // matches animation duration
  }

  setMessage() {
    if (this.guessWasCorrect) {
      this.displayMessage('Congratulations! You guessed the word!', 5000);
    } else if (this.invalidGuess) {
      this.displayMessage('Please enter a valid 5-letter word.');
    } else if (this.guesses.length === 0) {
      this.displayMessage('Guess a 5-letter word!');
    } else if (this.guesses.length < 6) {
      this.displayMessage('Keep guessing!');
    } else {
      this.displayMessage(`Game over! The correct answer was: ${this.correctAnswer}`, 5000);
    }
  }

  submitGuess(guess: string) {
    this.invalidGuess = false;
    if (guess.length !== 5) {
      this.invalidGuess = true;
      this.setMessage();
      return;
    }
    this.guessIsAWord(guess).subscribe(isWord => {
      guess = guess.toUpperCase();
      if (isWord || guess === this.correctAnswer) { // Allow the guess if it's a valid word or matches the correct answer
        const currentRow = this.grid.find(row => row[0].letter == '');
        if (currentRow) {
          for (let i = 0; i < 5; i++) { // in order to properly count yellow tiles, we need to first mark correct letters
            if (guess[i] === this.correctAnswer[i]) {
              currentRow[i].status = 'correct';
            }
            currentRow[i].letter = guess[i];
          }
          for (let i = 0; i < 5; i++) {
            if (currentRow[i].status === 'correct') continue;
            if (this.correctAnswer.includes(guess[i]) && this.correctAnswer.split(guess[i]).length - 1 > currentRow.filter(tile => this.hitStatuses.includes(tile.status) && tile.letter == guess[i]).length) {
              currentRow[i].status = 'present';
            } else {
              currentRow[i].status = 'absent';
            }
          }
          this.guesses.push(guess);
        }
      } else {
        this.invalidGuess = true;
      }
      this.setMessage();
    });
  }

  guessIsAWord(guess: string): Observable<boolean> {
    return this.http.get('https://api.dictionaryapi.dev/api/v2/entries/en/' + guess.toLowerCase())
      .pipe(
        map(data => Array.isArray(data)), // true if array, false if object
        catchError(() => of(false)) // If the API returns an error, treat as not a word;
      );
  }

  resetGame() {
    this.grid = Array.from({ length: 6 }, () => Array(5).fill({ letter: '', status: '', index: 0 }));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 5; j++) {
        this.grid[i][j] = { letter: '', status: '', index: j };
      }
    }
    this.guesses = [];
    this._correctAnswer = '';
    this.invalidGuess = false;
    this.ngOnInit();
  }
}
