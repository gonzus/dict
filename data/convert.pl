use strict;
use warnings;

exit main();

sub process_file {
    my ($name, $cat, $part) = @_;
    # printf("File [%s]\n", $name);

    my $count = 0;
    open my $fp, '<', $name or die "Could not open $name: $!";
    while( my $line = <$fp>)  {
        ++$count;
        chomp($line);
        # printf("%3d | [%s]\n", $count, $line);
        my @cols = split(' ', $line);
        my $en = sprintf("%s:%s"   , 'en', $cols[2]);
        my $nl = sprintf("%s:%s+%s", 'nl', $cols[1], $cols[0]);
        my $es = sprintf("%s:%s+%s", 'es', $cols[4], $cols[3]);
        printf("add -c %s %s %-30.30s %-30.30s %s\n",
               $cat, $part, $en, $nl, $es);
    }
    close $fp;
}

sub main {
    foreach my $arg (@ARGV) {
        process_file($arg, 'clothing', 'noun');
    }
    return 0;
}
