<?php
/**
 * Project: Poker
 * Developer: Colin Michaels
 * Date: 10/23/19
 * Time: 11:07 AM
 */

namespace Poker;

use Illuminate\Database\Eloquent\Model;

class Chip extends Model {

    const DENOMINATIONS = [1,5,10,25,50,100,500,1000];
    public $value;

    public function __construct($value = 1) {

        $this->value = $value;
    }

    public function getImagePath(){

        return asset('Poker/chips/');
    }

    public function getImageAttribute(){

        return $this->getImagePath()."/".$this->value.".svg";
    }

    public function split(){

        $chips = [];
          foreach(array_reverse(self::DENOMINATIONS) as $DENOMINATION){
              while($this->value >= $DENOMINATION  ) {
                  if ( $this->value > 0 ) {
                      array_push( $chips, new Chip($DENOMINATION) );
                      $this->value -= $DENOMINATION;
                  }
              }
          }
          return $chips;
    }
}
