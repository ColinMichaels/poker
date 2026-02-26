<template>
    <div id="deck" ref="deck" :class="{is_flipped: !is_flipped}" class="flex flex-wrap" >
            <card
                :ref="card.name"
                v-for="card in cards"
                :name="card.name"
                :key="card.name"
                :is_flipped="is_flipped"
                v-on:card-clicked="flip"
            />
    </div>
</template>

<script>
    import Game from "@/plugins/game/GamePlugin";
    import Card from "./Card";

    const initData = () => ({
        is_flipped: false,
        cards: Game.store().cards,
        play_hand: [],
        position: Math.floor(Math.random() * (52 - 1) + 1),
        selected: null
    });

    export default {
        name: "Deck",
        data() {
            return {
                is_flipped: false,
                cards: initData().cards,
                play_hand: [],
                position: Math.floor(Math.random() * (52 - 1) + 1),
                selected: null
            }
        },
        components: {
            Card
        },
        methods: {
            remove(card) {
                Game.sound('/Poker/sounds/card.mp3');
                //_.slice(this.cards, _.findIndex(this.cards,  card.name ));
            },
            deal(num_per) {
                this.resetDeck();
            },
            draw(card) {
                let deck_card = this.cards[this.position];
                Game.broadcast('card.start', deck_card.name);
            },
            resetDeck() {
                Object.assign(this.$data, initData());
                this.flipAll(true);
                this.shuffle();
                this.flipAll(false);

            },
            flip(card) {
                card.flipped = !card.flipped;
                Game.sound('/Poker/sounds/card.mp3');
            },
            flipAll(dir = null) {
                this.is_flipped = (dir) ? dir : !this.is_flipped;
                this.cards.forEach((card) => {
                    let cur_card = this.$refs[card.name][0];
                    if (cur_card !== undefined) {
                        cur_card.flipped = (dir) ? dir : this.is_flipped;
                    }
                });
                Game.sound('/Poker/sounds/card.mp3');

            },
            shuffle() {
                this.cards = _.shuffle(this.cards);
                Game.sound('/Poker/sounds/shuffle.mp3');
            },
            updateCard(card) {
                this.draw(card);
            }
        },
        mounted() {
            Game.listen('deck.shuffle', this.shuffle);
            Game.listen('deck.deal', this.deal);
            Game.listen('deck.flip', this.flipAll);
            Game.listen('deck.reset', this.resetDeck);
        }
    }
</script>
