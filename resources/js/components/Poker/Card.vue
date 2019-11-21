<template>
    <div class="card-container" :class="{flipped: !flipped}" @click="clicked">
        <div class="card">
            <div class="card-front" >
                <img :src="card_image_front" alt="card_front"/>
            </div>
            <div class="card-back">
                <img :src="card_back" alt="card_back"/>
            </div>
        </div>
    </div>
</template>

<script>
    import Game from '@/plugins/game/GamePlugin';
    const imagePath = '/Poker/cards/';

    export default {
        name: "PokerCard",
        props: {
            name,
            is_flipped: {
                type: Boolean,
                default: false
            },
            is_frozen:{
               type: Boolean,
               default: false
            },
        },
        data() {
            return {
                card_back: Game.store().card_back,
                card_front: '/Poker/cards/AS.svg',
                flipped : this.is_flipped
            }
        },
        methods: {
            clicked() {
                if(!this.is_frozen) {
                    this.$emit('card-clicked', this);
                }
            }
        },
        computed: {
            card_image_front() {
                return this.card_front = imagePath + this.name + '.svg';
            },
            description() {
               return  Game.getCardDescription(this.name);
            }
        }
    }
</script>
