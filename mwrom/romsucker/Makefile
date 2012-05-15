CFLAGS = -O2
BIN = romsucker

all :	$(BIN)

main : $(BIN).c
	$(CC) $(CFLAGS) -o $(BIN) $(BIN).c

clean :
	rm -f nul core *.o $(BIN) *~

check-syntax:
	$(CC) -o nul -Wall -S $(CHK_SOURCES)
