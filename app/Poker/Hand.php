<?php

namespace Poker;

class Hand extends Game
{
    private $cards; //cards in hand
    private $score; //hands score;

    public function __construct() {
        $this->clearHand();
        parent::__construct();
    }
    public function calculateScore($hand) {
        foreach ($this->getRanks() as $rank) {
            echo $rank;
        }
    }
    public function clearHand() {
        $this->cards = [];
    }
    public function addCardToHand($card) {
        // $card is a Card object
        $this->cards[] = $card;
    }
    public function getCards() {
        return $this->cards;
    }
    public function getRanks() {
        $ranks = [];
        foreach ($this->getCards() as $card) {
            $ranks[] = $card->getRank();
        }
        return $ranks;
    }
    public function getValues() {
        $array = [];
        foreach ($this->getCards() as $card) {
            $array[] = $card->getValue();
        }
        return $array;
    }
    public function getSuits() {
        $suits = [];
        foreach ($this->getCards() as $card) {
            $suits[] = $card->getSuit();
        }
        return $suits;
    }
    public function setScore($score) {
        $this->score = $score;
    }
    public function getScore() {
        return $this->score;
    }


}
