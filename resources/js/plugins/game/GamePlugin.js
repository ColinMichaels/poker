import GameComponent from './GameComponent';
import AudioPlugin from "../audio/AudioPlugin";

const
    names = {
        A: 'Ace',
        2: 'Two',
        3: 'Three',
        4: 'Four',
        5: 'Five',
        6: 'Six',
        7: 'Seven',
        8: 'Eight',
        9: 'Nine',
        10: 'Ten',
        J: 'Jack',
        Q: 'Queen',
        K: 'King'
    },
    suit_names = {
        S: "Spades",
        C: "Clubs",
        H:"Hearts",
        D:"Diamonds"
    },
    suits = {
        "S": 1,
        "C": 2,
        "H": 4,
        "D": 8
    },
    hands = [
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
    A = 14,
    K = 13,
    Q = 12,
    J = 11,
    conversion = {
        "A": 14,
        "K": 13,
        "Q": 12,
        "J": 11,
        10: 10,
        9: 9,
        8: 8,
        7: 7,
        6: 6,
        5: 5,
        4: 4,
        3: 3,
        2: 2
    },
    deck = [
        {name: "2C", rank: 2},
        {name: "3C", rank: 3},
        {name: "4C", rank: 4},
        {name: "5C", rank: 5},
        {name: "6C", rank: 6},
        {name: "7C", rank: 7},
        {name: "8C", rank: 8},
        {name: "9C", rank: 9},
        {name: "10C", rank: 10},
        {name: "JC", rank: "J"},
        {name: "QC", rank: "Q"},
        {name: "KC", rank: "K"},
        {name: "AC", rank: "A"},

        {name: "2D", rank: 2},
        {name: "3D", rank: 3},
        {name: "4D", rank: 4},
        {name: "5D", rank: 5},
        {name: "6D", rank: 6},
        {name: "7D", rank: 7},
        {name: "8D", rank: 8},
        {name: "9D", rank: 9},
        {name: "10D", rank: 10},
        {name: "JD", rank: "J"},
        {name: "AD", rank: "Q"},
        {name: "QD", rank: "K"},
        {name: "KD", rank: "A"},

        {name: "2H", rank: 2},
        {name: "3H", rank: 3},
        {name: "4H", rank: 4},
        {name: "5H", rank: 5},
        {name: "6H", rank: 6},
        {name: "7H", rank: 7},
        {name: "8H", rank: 8},
        {name: "9H", rank: 9},
        {name: "10H", rank: 10},
        {name: "JH", rank: "J"},
        {name: "QH", rank: "Q"},
        {name: "KH", rank: "K"},
        {name: "AH", rank: "A"},

        {name: "2S", rank: 2},
        {name: "3S", rank: 3},
        {name: "4S", rank: 4},
        {name: "5S", rank: 5},
        {name: "6S", rank: 6},
        {name: "7S", rank: 7},
        {name: "8S", rank: 8},
        {name: "9S", rank: 9},
        {name: "10S", rank: 10},
        {name: "JS", rank: "J"},
        {name: "QS", rank: "Q"},
        {name: "KS", rank: "K"},
        {name: "AS", rank: "A"}
    ];

let GamePlugin = {
    install: function (Vue, options = {}) {
        Vue.component('game', GameComponent);
        console.info("REGISTERING GAME PLUGIN KEY:" + options.key);
        GamePlugin.events = new Vue();

        Vue.prototype.$game = {
            start(name, params = {}) {
                console.log('Starting, a game of ' + name);
                location.hash = name;
                GamePlugin.events.$emit('game.start', name);
            },
        }
    },
    broadcast(channel, message) {
        this.events.$emit(channel, message);
    },
    listen(channel, message) {
        return this.events.$on(channel, message);
    },
    sound(src) {
        return AudioPlugin.play(src)
    },
    getDeck() {
        return deck;
    },
    getCardDescription(card) {
        let split = this.splitCardName(card);
        return names[split.value] + " of " + suit_names[split.suit];
    },
    splitCardName(card) {
        let value = card.match(/^[a-zA-Z]{1}|[0-9]{1,2}/g);
        let suit = card.match(/[A-Z| a-z]$/g);
        return {value, suit};
    },
    rankHand(hand) {
        // Calculates the Rank of a 5 card Poker hand using bit manipulations.
        // Many thanks to: //http://www.codeproject.com/Articles/569271/A-Poker-hand-analyzer-in-JavaScript-using-bit-math
        function rankPokerHand(cs, ss) {
            let v, i, o, s = 1 << cs[0] | 1 << cs[1] | 1 << cs[2] | 1 << cs[3] | 1 << cs[4];
            for (i = -1, v = o = 0; i < 5; i++, o = Math.pow(2, cs[i] * 4)) {
                v += o * ((v / o & 15) + 1);
            }
            v = v % 15 - ((s / (s & -s) === 31) || (s === 0x403c) ? 3 : 1);
            v -= (ss[0] === (ss[1] | ss[2] | ss[3] | ss[4])) * ((s === 0x7c00) ? -5 : 1);
            return {
                evaluatedHand: hands[v] + (s == 0x403c ? " (Ace low)" : "")
            }
        }

        const handTranslator = (hand) => {
            let hand_values = [];
            let hand_suits = [];
            for (let i = 0; i < hand.length; i++) {
                let split = this.splitCardName(hand[i]);
                hand_values.push(conversion[split.value]);
                hand_suits.push(suits[split.suit]);
            }
            return {
                values: hand_values,
                suits: hand_suits
            }
        };

        let handTranslated = handTranslator(hand);

        return rankPokerHand(handTranslated.values, handTranslated.suits);


    },
    store() {
        return {
            state: {
                is_started: false,
                is_completed: false,
                is_flipped: false,
            },
            card_back: '/Poker/cards/Card_back_06.svg',
            cards: this.getDeck()

        };

    }
};

export default GamePlugin;
