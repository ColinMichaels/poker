<?php

namespace Poker;

class Deck {


    const SUIT_COUNT = 13;

    public $cards, $total_cards;
    public $cards_in_suit;

    public function __construct($cards_in_suit = self::SUIT_COUNT) {
        $this->total_cards = 0;
        $this->cards_in_suit = $cards_in_suit;
        $this->deal();
    }

    public function suits() {
        return Suit::SUITS;
    }

    public function deal() {

        foreach ( Suit::SUITS as $suit ) {
            for ( $card = 0; $card < 13; $card ++ ) {
                $this->cards[]     = new Card( $suit, $card + 1 );
                $this->total_cards += 1;
            }
        }

        return $this;

    }

    public function shuffle() {

        shuffle( $this->cards );
        return $this;
    }

    public function removeCard( $card ) {

        unset( $this->cards[ $card ] );

    }

    public function hasCount() {
        return count( $this->cards );
    }

    public function reset() {
        $this->deal()->shuffle();
    }

}

