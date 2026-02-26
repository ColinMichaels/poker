<template>

</template>
<script>
    export default {
        name: 'Poker',
        mounted: function () {
            this.status.push('App mounted.')
//this.dealHand(5)

            this.$emit('mounted')
            console.log('Event fired.')

        },
        methods: {
            getDeck: function () {
                let suits = ['C', 'H', 'S', 'S']
                let values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
                for (let s = 0; s < suits.length; s++) {
                    for (let v = 0; v < values.length; v++) {
                        let card = {};
                        card["value"] = values[v];
                        card["suit"] = suits[s]
                        console.log(card['suit'])
// card.code: Get the '0' if it's a 10, otherwise get the first character. Then concat value.
                        values[v] === '10' ? card["code"] = values[v].charAt(1) + suits[s].charAt(0) : card["code"] = values[v].charAt(0) + suits[s].charAt(0);
                        card["code"] === 'AD' ? card["image"] = 'aceDiamonds.png' : card["image"] = card["code"] + '.png'
// Put the card object in the deck.
                        this.deck.push(card);
                    }
                }
                console.log('Deck created')
            },
            shuffleDeck: function () {
                var m = this.deck.length,
                    t, i;
                while (m) {
                    i = Math.floor(Math.random() * m--);
                    t = this.deck[m];
                    this.deck[m] = this.deck[i];
                    this.deck[i] = t;
                }
                console.log('Fisher-Yates shuffle')
            },
            placeBet: function (bet) {
                if (this.betAllowed) {
                    this.coins_won = 0
                    this.coins_bet = bet
                    this.startOfHand = true
                    this.numberOfDraws = 0
                    this.disableShuffle = false
                    console.log('Bet: ', this.coins_bet)
                    console.log('StartOfHand: ', this.startOfHand)
                }

            },
            drawFromDeck: function (cardsToDraw) {

                if (this.numberOfDraws <= 1) {
                    console.log('Number of draws: ', this.numberOfDraws)
                    if (this.numberOfDraws === 0) {
// Initial phase: Draw 5 cards.
                        console.log('Initial phase: Draw 5 cards')
                        this.hand = this.deck.slice(0, cardsToDraw)
                        this.deck.splice(0, cardsToDraw)
                        this.betAllowed = false
                        this.discardsAllowed = true
                        console.log('Cards left: ', this.deck.length)
                        this.numberOfDraws = this.numberOfDraws + 1
                        this.evaluateHand()
                    } else {

                        if (this.discardsAllowed) {
// Drawing phase: Replace discards with drawn cards
                            console.log('Drawing phase: Replace discards with drawn cards')
                            this.drawnCards = this.deck.slice(0, cardsToDraw)
                            for (let i = 0; i < this.discards.length; i++) {
                                this.hand[this.discards[i]] = this.drawnCards[i];
                            }
// Remove drawn cards from deck
                            this.deck.splice(0, cardsToDraw)
                            this.discards = []
                            this.startOfHand = false
                            this.betAllowed = false
                            this.discardsAllowed = false
                            console.log('Cards left: ', this.deck.length)
                            this.numberOfDraws = this.numberOfDraws + 1
                            this.evaluateHand()
                        }

                    }
                }


            },
            dealHand: function () {
                if (!this.disableShuffle) {
// set game variables
                    const CARDS_TO_DRAW = 5
                    this.deck = []
                    this.discards = []
                    this.numberOfDraws = 0
                    this.coins_won = 0
                    this.startOfHand = false
                    this.disableShuffle = true
                    this.coins = this.coins - this.coins_bet
// start the hand
                    this.getDeck()
                    this.shuffleDeck()
                    this.drawFromDeck(CARDS_TO_DRAW)
                }


            },

            evaluateHand: function () {


                const hands = [
                        "4 of a Kind",
                        "Straight Flush",
                        "Straight",
                        "Flush",
                        "High Card",
                        "1 Pair",
                        "2 Pair",
                        "Royal Flush",
                        "3 of a Kind",
                        "Full House"
                    ],
                    payout = [
                        25, // 4 of a kind
                        50, // Straight flush
                        4, // Straight
                        6, // Flush
                        0, // High card
                        1, // Pair
                        2, // Two pair
                        976, // Royal Flush
                        3, // 3 of a kind
                        9 // Full house
                    ],
                    A = 14,
                    K = 13,
                    Q = 12,
                    J = 11,
                    suits = {
                        "S": 1,
                        "C": 2,
                        "H": 4,
                        "D": 8
                    },
                    conversion = {
                        "A": 14,
                        "K": 13,
                        "Q": 12,
                        "J": 11,
                        "10": 10,
                        "9": 9,
                        "8": 8,
                        "7": 7,
                        "6": 6,
                        "5": 5,
                        "4": 4,
                        "3": 3,
                        "2": 2
                    }

// Calculates the Rank of a 5 card Poker hand using bit manipulations.
// Many thanks to: //http://www.codeproject.com/Articles/569271/A-Poker-hand-analyzer-in-JavaScript-using-bit-math

                function rankPokerHand(cs, ss) {
                    let v, i, o, s = 1 << cs[0] | 1 << cs[1] | 1 << cs[2] | 1 << cs[3] | 1 << cs[4];
                    for (i = -1, v = o = 0; i < 5; i++, o = Math.pow(2, cs[i] * 4)) {
                        v += o * ((v / o & 15) + 1);
                    }
                    v = v % 15 - ((s / (s & -s) == 31) || (s == 0x403c) ? 3 : 1);
                    v -= (ss[0] == (ss[1] | ss[2] | ss[3] | ss[4])) * ((s == 0x7c00) ? -5 : 1);
//console.log("Hand: " + hands[v] + (s == 0x403c ? " (Ace low)" : "") + "<br/>");
                    let evaluatedHand = hands[v] + (s == 0x403c ? " (Ace low)" : "");


                    console.log('Evaluation s:', s.toString(16), ' v: ', v)
                    console.log('Payout: ', payout[v])
                    return {
                        evaluatedHand: evaluatedHand,
                        coins_won: payout[v]
                    }
                }

                let arraySuits = [];
                let arrayValues = [];
                for (let i = 0; i < this.hand.length; i++) {
                    console.log(this.hand[i].value + ' / ' + this.hand[i].suit)
                    arraySuits.push(suits[this.hand[i].suit]);
                    arrayValues.push(conversion[this.hand[i].value]);
                }
                console.log('Suits: ', arraySuits)
                console.log('Values: ', arrayValues)
                let myHand = rankPokerHand(arrayValues, arraySuits);
                console.log('myHand.evaluatedHand', myHand.evaluatedHand)

// intercept jacks or better pair
                if (myHand.evaluatedHand === '1 Pair') {
                    let jacksOrBetter = arrayValues.filter(function (value) {
// how many cards above 10 in value?
                        return value > 10;
                    }).length
// if it's at least 2 cards, then it's jacks or better
                    if (jacksOrBetter > 1) {
                        myHand.evaluatedHand = myHand.evaluatedHand + ' (Jacks or better)'
                    } else {
// otherwise low pair. Reset coins_won to 0 (from 1)
                        myHand.evaluatedHand = 'Low pair'
                        myHand.coins_won = 0
                    }
                }


                this.evaluatedHand = myHand.evaluatedHand

                if (this.numberOfDraws > 1) {
                    this.coins_won = this.coins_bet * myHand.coins_won
                    this.coins = this.coins + this.coins_won
                    this.betAllowed = true
                    this.handFinished = !this.handFinished;
                    this.$store.dispatch('incrementHandcount')

// update handstats
                    let statPayload = {}
                    statPayload.id = this.$store.state.handCount
                    statPayload.evaluatedHand = myHand.evaluatedHand
                    statPayload.coins_won = this.coins_won

                    this.$store.dispatch('incrementStats', statPayload)


                }


            },
            showWinnings: function () {
                if (this.numberOfDraws > 1) {
                    return true
                } else {
                    return false
                }
            },
            checkForDiscard: function (cardIndex) {
                if (this.numberOfDraws <= 1) {
                    if (_.includes(this.discards, cardIndex)) {
                        let target = this.discards.indexOf(cardIndex);
                        this.discards.splice(target, 1);
                        console.log('Removed from array')
                    } else {
                        this.discards.push(cardIndex);
                        this.discards.sort();
                        console.log('Added to array')
                    }
                }
            },
            showDiscardLabel: function (index) {
                if (this.numberOfDraws <= 1) {
                    if (_.includes(this.discards, index)) {
                        return true
                    } else {
                        return false
                    }
                }

            }
        },
        data() {
            return {
                status: [],
                deck: [],
                hand: [],
                coins_bet: 0,
                drawnCards: [],
                localImagePath: '../static/img/',
                discards: [],
                numberOfDraws: 0,
                evaluatedHand: '',
                cardsLeft: '',
                coins: 1000,
                payout: '',
                coins_won: 0,
                disableShuffle: true,
                disableDiscards: true,
                startOfHand: true,
                betAllowed: true

            }
        },

    }
</script>
